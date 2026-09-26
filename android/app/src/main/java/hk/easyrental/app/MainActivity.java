package hk.easyrental.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String HOME = "https://easyrentalhk.vercel.app/";
    private static final String LOCAL = "file:///android_asset/local/index.html?v=8";

    private WebView webView;
    private View chooser;
    private View offline;
    private String mode = "choose";
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraOutput;
    private boolean waitingCamera;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.web);
        chooser = findViewById(R.id.chooser);
        offline = findViewById(R.id.offline);
        Button local = findViewById(R.id.use_local);
        Button online = findViewById(R.id.use_online);
        Button retry = findViewById(R.id.retry);
        Button offlineLocal = findViewById(R.id.offline_local);
        local.setOnClickListener(v -> startLocal());
        online.setOnClickListener(v -> startOnline());
        retry.setOnClickListener(v -> startOnline());
        offlineLocal.setOnClickListener(v -> startLocal());

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.addJavascriptInterface(new LocalBridge(), "Android");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if ("online".equals(mode)) {
                    offline.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if ("online".equals(mode) && request.isForMainFrame()) showOffline();
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                openImageChooser(params.isCaptureEnabled());
                return true;
            }
        });

        String saved = getPreferences(MODE_PRIVATE).getString("mode", "choose");
        if ("local".equals(saved)) startLocal();
        else if ("online".equals(saved)) startOnline();
        else showChooser();
    }

    private void showChooser() {
        mode = "choose";
        webView.setVisibility(View.GONE);
        offline.setVisibility(View.GONE);
        chooser.setVisibility(View.VISIBLE);
    }

    private void remember(String next) {
        getPreferences(MODE_PRIVATE).edit().putString("mode", next).apply();
    }

    private void startLocal() {
        mode = "local";
        remember("local");
        chooser.setVisibility(View.GONE);
        offline.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(LOCAL);
    }

    private void startOnline() {
        mode = "online";
        remember("online");
        chooser.setVisibility(View.GONE);
        if (!isOnline()) {
            showOffline();
            return;
        }
        offline.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(HOME);
    }

    private void showOffline() {
        webView.setVisibility(View.GONE);
        chooser.setVisibility(View.GONE);
        offline.setVisibility(View.VISIBLE);
    }

    private boolean isOnline() {
        ConnectivityManager manager = getSystemService(ConnectivityManager.class);
        if (manager == null) return false;
        Network network = manager.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = manager.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private File ledgerFile() {
        return new File(getFilesDir(), "ledger.json");
    }

    @Override
    public void onBackPressed() {
        if (!"choose".equals(mode) && webView.getVisibility() == View.VISIBLE && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        if (!"choose".equals(mode)) {
            showChooser();
            return;
        }
        super.onBackPressed();
    }

    private void openImageChooser(boolean capture) {
        if (capture && ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            waitingCamera = true;
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, 77);
            return;
        }
        waitingCamera = false;
        Intent camera = null;
        try {
            File dir = new File(getCacheDir(), "capture");
            if (!dir.exists()) dir.mkdirs();
            File photo = new File(dir, "capture.jpg");
            cameraOutput = FileProvider.getUriForFile(this, "hk.easyrental.app.fileprovider", photo);
            camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraOutput);
            camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (Exception ignored) {
            camera = null;
            cameraOutput = null;
        }
        if (capture && camera != null) {
            startActivityForResult(camera, 50);
            return;
        }
        Intent content = new Intent(Intent.ACTION_GET_CONTENT);
        content.addCategory(Intent.CATEGORY_OPENABLE);
        content.setType("image/*");
        content.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        Intent picker = Intent.createChooser(content, "相簿");
        if (camera != null) picker.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
        startActivityForResult(picker, 50);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 77 && waitingCamera) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) openImageChooser(true);
            else finishFileChooser(null);
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != 50) return;
        Uri[] uris = null;
        if (result == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                uris = new Uri[count];
                for (int i = 0; i < count; i++) uris[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                uris = new Uri[]{data.getData()};
            } else if (cameraOutput != null) {
                uris = new Uri[]{cameraOutput};
            }
        }
        finishFileChooser(uris);
    }

    private void finishFileChooser(Uri[] uris) {
        if (fileCallback != null) fileCallback.onReceiveValue(uris);
        fileCallback = null;
    }

    private File photoDir() {
        return new File(getFilesDir(), "photos");
    }

    private JSONArray readPhotoIndex() {
        File file = new File(photoDir(), "index.json");
        if (!file.exists()) return new JSONArray();
        try {
            return new JSONArray(readText(file));
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private void writePhotoIndex(JSONArray list) throws Exception {
        File dir = photoDir();
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("photos");
        try (FileOutputStream out = new FileOutputStream(new File(dir, "index.json"))) {
            out.write(list.toString().getBytes(StandardCharsets.UTF_8));
        }
    }

    private String readText(File file) throws Exception {
        byte[] buf = readBytes(file);
        return new String(buf, StandardCharsets.UTF_8);
    }

    private byte[] readBytes(File file) throws Exception {
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] buf = new byte[(int) file.length()];
            int read = 0;
            while (read < buf.length) {
                int n = in.read(buf, read, buf.length - read);
                if (n < 0) break;
                read += n;
            }
            if (read == buf.length) return buf;
            byte[] trimmed = new byte[read];
            System.arraycopy(buf, 0, trimmed, 0, read);
            return trimmed;
        }
    }

    private class LocalBridge {
        @JavascriptInterface
        public void openOnline() {
            runOnUiThread(MainActivity.this::startOnline);
        }

        @JavascriptInterface
        public void savePhoto(String id, String tenancyId, String kind, String dataUrl) {
            synchronized (MainActivity.this) {
                try {
                    if (id == null || !id.matches("[A-Za-z0-9_-]{4,40}")) return;
                    int comma = dataUrl == null ? -1 : dataUrl.indexOf(',');
                    String raw = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
                    byte[] bytes = Base64.decode(raw, Base64.DEFAULT);
                    if (bytes.length == 0 || bytes.length > 500_000) return;
                    File dir = photoDir();
                    if (!dir.exists() && !dir.mkdirs()) return;
                    try (FileOutputStream out = new FileOutputStream(new File(dir, id + ".jpg"))) {
                        out.write(bytes);
                    }
                    JSONArray list = readPhotoIndex();
                    JSONObject row = new JSONObject();
                    row.put("id", id);
                    row.put("tenancyId", tenancyId);
                    row.put("kind", "stamp".equals(kind) ? "stamp" : "lease");
                    row.put("created", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()));
                    list.put(row);
                    writePhotoIndex(list);
                } catch (Exception ignored) {
                    /* a failed photo should not wipe the ledger */
                }
            }
        }

        @JavascriptInterface
        public String listPhotos(String tenancyId) {
            synchronized (MainActivity.this) {
                try {
                    JSONArray list = readPhotoIndex();
                    JSONArray out = new JSONArray();
                    for (int i = 0; i < list.length(); i++) {
                        JSONObject row = list.getJSONObject(i);
                        if (tenancyId.equals(row.optString("tenancyId"))) out.put(row);
                    }
                    return out.toString();
                } catch (Exception ignored) {
                    return "[]";
                }
            }
        }

        @JavascriptInterface
        public String loadPhoto(String id) {
            synchronized (MainActivity.this) {
                try {
                    if (id == null || !id.matches("[A-Za-z0-9_-]{4,40}")) return "";
                    File file = new File(photoDir(), id + ".jpg");
                    if (!file.exists()) return "";
                    return "data:image/jpeg;base64," + Base64.encodeToString(readBytes(file), Base64.NO_WRAP);
                } catch (Exception ignored) {
                    return "";
                }
            }
        }

        @JavascriptInterface
        public void deletePhoto(String id) {
            synchronized (MainActivity.this) {
                try {
                    if (id == null || !id.matches("[A-Za-z0-9_-]{4,40}")) return;
                    new File(photoDir(), id + ".jpg").delete();
                    JSONArray list = readPhotoIndex();
                    JSONArray next = new JSONArray();
                    for (int i = 0; i < list.length(); i++) {
                        JSONObject row = list.getJSONObject(i);
                        if (!id.equals(row.optString("id"))) next.put(row);
                    }
                    writePhotoIndex(next);
                } catch (Exception ignored) {
                    /* keep the remaining photos */
                }
            }
        }

        @JavascriptInterface
        public void saveLedger(String json) {
            try (FileOutputStream out = new FileOutputStream(ledgerFile())) {
                out.write(json.getBytes(StandardCharsets.UTF_8));
            } catch (Exception ignored) {
                /* the page also keeps a copy in the WebView store */
            }
        }

        @JavascriptInterface
        public String loadLedger() {
            File file = ledgerFile();
            if (!file.exists()) return "";
            try (java.io.FileInputStream in = new java.io.FileInputStream(file)) {
                byte[] buf = new byte[(int) file.length()];
                int read = 0;
                while (read < buf.length) {
                    int n = in.read(buf, read, buf.length - read);
                    if (n < 0) break;
                    read += n;
                }
                return new String(buf, 0, read, StandardCharsets.UTF_8);
            } catch (Exception ignored) {
                return "";
            }
        }

        @JavascriptInterface
        public void shareLedger(String json) {
            runOnUiThread(() -> {
                try {
                    File dir = new File(getCacheDir(), "share");
                    if (!dir.exists() && !dir.mkdirs()) return;
                    File file = new File(dir, "easyrental-ledger.json");
                    try (FileOutputStream out = new FileOutputStream(file)) {
                        out.write(json.getBytes(StandardCharsets.UTF_8));
                    }
                    Uri uri = FileProvider.getUriForFile(MainActivity.this, "hk.easyrental.app.fileprovider", file);
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("application/json");
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(send, "匯出帳簿"));
                } catch (Exception ignored) {
                    /* sharing is optional */
                }
            });
        }
    }
}

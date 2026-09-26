package hk.easyrental.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String HOME = "https://easyrentalhk.vercel.app/";
    private static final String LOCAL = "file:///android_asset/local/index.html?v=4";

    private WebView webView;
    private View chooser;
    private View offline;
    private String mode = "choose";

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

    private class LocalBridge {
        @JavascriptInterface
        public void openOnline() {
            runOnUiThread(MainActivity.this::startOnline);
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

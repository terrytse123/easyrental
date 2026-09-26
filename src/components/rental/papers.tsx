import { useEffect, useState } from "react";
import { addLeaseFile, listLeaseFiles, removeLeaseFile, type LeaseFile } from "@/lib/rental/files.functions";
import { compressImage } from "@/lib/rental/image";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";

export function LeasePapers({ tenancyId }: { tenancyId: string }) {
  const lang = useRental((s) => s.lang);
  const [files, setFiles] = useState<LeaseFile[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  function reload() {
    void listLeaseFiles({ data: tenancyId })
      .then(setFiles)
      .catch(() => setFiles([]));
  }

  useEffect(() => {
    reload();
  }, [tenancyId]);

  async function upload(kind: "lease" | "stamp", list: FileList | null) {
    if (!list?.length) return;
    setError("");
    try {
      for (const file of Array.from(list)) {
        const payload = await compressImage(file);
        await addLeaseFile({ data: { tenancyId, kind, payload } });
      }
      reload();
    } catch {
      setError(t(lang, "paperFailed"));
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await removeLeaseFile({ data: id });
      reload();
    } catch {
      setError(t(lang, "paperFailed"));
    }
  }

  return (
    <div className="mt-4 grid gap-3 border-t border-line pt-3">
      <p className="text-sm text-muted">{t(lang, "papersHint")}</p>
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      <PaperGroup
        title={t(lang, "leasePapers")}
        files={(files ?? []).filter((file) => file.kind === "lease")}
        onUpload={(list) => void upload("lease", list)}
        onRemove={(id) => void remove(id)}
        onOpen={setOpen}
        take={t(lang, "takePhoto")}
        album={t(lang, "fromAlbum")}
        removeLabel={t(lang, "delete")}
      />
      <PaperGroup
        title={t(lang, "stampPapers")}
        files={(files ?? []).filter((file) => file.kind === "stamp")}
        onUpload={(list) => void upload("stamp", list)}
        onRemove={(id) => void remove(id)}
        onOpen={setOpen}
        take={t(lang, "takePhoto")}
        album={t(lang, "fromAlbum")}
        removeLabel={t(lang, "delete")}
      />
      {open ? (
        <button type="button" className="fixed inset-0 z-50 bg-ink/80 p-4" onClick={() => setOpen(null)}>
          <img src={open} alt="" className="mx-auto max-h-full max-w-full object-contain" />
        </button>
      ) : null}
    </div>
  );
}

function PaperGroup({
  title,
  files,
  onUpload,
  onRemove,
  onOpen,
  take,
  album,
  removeLabel,
}: {
  title: string;
  files: LeaseFile[];
  onUpload: (list: FileList | null) => void;
  onRemove: (id: string) => void;
  onOpen: (src: string) => void;
  take: string;
  album: string;
  removeLabel: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{title}</p>
        <div className="flex gap-2">
          <label className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm font-semibold text-brass">
            {take}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                onUpload(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          <label className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm font-semibold text-brass">
            {album}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                onUpload(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      {files.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {files.map((file) => (
            <li key={file.id} className="w-24">
              <button type="button" onClick={() => onOpen(file.payload)}>
                <img src={file.payload} alt="" className="h-24 w-24 rounded-xl object-cover" />
              </button>
              <p className="mt-1 text-xs text-muted">{file.created}</p>
              <button type="button" className="text-xs text-clay" onClick={() => onRemove(file.id)}>
                {removeLabel}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

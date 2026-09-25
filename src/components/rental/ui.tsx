import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Money({ children }: { children: ReactNode }) {
  return <span className="tabular-nums">{children}</span>;
}

export function Pill({
  tone,
  children,
}: {
  tone: "brass" | "jade" | "clay" | "ink";
  children: ReactNode;
}) {
  const tones = {
    brass: "bg-brass-soft text-brass",
    jade: "bg-jade-soft text-jade",
    clay: "bg-clay-soft text-clay",
    ink: "bg-ink text-paper",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl md:max-w-lg md:rounded-3xl md:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-full text-muted hover:bg-paper"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

const control =
  "w-full rounded-xl border border-line bg-paper px-3 py-3 text-base text-fg outline-none focus:border-brass";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={control} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${control} min-h-24`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={control} />;
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-4 text-sm font-semibold text-paper disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-card px-4 text-sm font-medium text-ink"
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-clay-soft px-4 text-sm font-medium text-clay"
    >
      {children}
    </button>
  );
}

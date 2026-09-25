import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { GROK_PROVIDERS, authClient, authEnabled, rememberAuthToken, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";

const searchSchema = z.object({
  mode: z.enum(["register", "signin"]).optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { mode } = Route.useSearch();
  const lang = useRental((s) => s.lang);
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const registering = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/desk" />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(t(lang, "passwordShort"));
      return;
    }
    setBusy(true);
    try {
      const payload = { email: email.trim(), password };
      const result = registering
        ? await authClient.signUp.email({
            ...payload,
            name: name.trim() || email.trim(),
            fetchOptions: { onSuccess: (ctx) => rememberAuthToken(ctx.response) },
          })
        : await authClient.signIn.email({
            ...payload,
            fetchOptions: { onSuccess: (ctx) => rememberAuthToken(ctx.response) },
          });
      if (result.error) {
        const message = result.error.message ?? "";
        setError(
          /exist/i.test(message)
            ? t(lang, "emailTaken")
            : /invalid origin/i.test(message)
              ? t(lang, "originBlocked")
              : message || t(lang, "authFailed"),
        );
        setBusy(false);
        return;
      }
      await authClient.getSession();
      await navigate({ to: "/desk" });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t(lang, "authFailed"));
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-paper text-fg md:grid-cols-[0.9fr_1.1fr]">
      <section className="bg-ink px-6 py-8 text-paper md:px-10 md:py-12">
        <Link to="/" className="font-display text-4xl">
          {t(lang, "brand")}
        </Link>
        <p className="mt-2 text-sm text-brass-soft">{t(lang, "brandEn")}</p>
        <p className="mt-8 max-w-sm text-sm leading-relaxed text-paper/75">{t(lang, "marketLead")}</p>
      </section>
      <section className="px-6 py-8 md:px-12 md:py-12">
        <h1 className="font-display text-4xl text-ink">{registering ? t(lang, "register") : t(lang, "signIn")}</h1>
        <p className="mt-3 text-sm">
          <Link to="/login" search={{ mode: registering ? "signin" : "register" }} className="text-brass">
            {registering ? t(lang, "haveAccount") : t(lang, "register")}
          </Link>
        </p>
        {!authEnabled ? (
          <p className="mt-6 text-sm text-muted">{t(lang, "authFailed")}</p>
        ) : (
          <form onSubmit={submit} className="mt-8 max-w-md space-y-4">
            {registering && (
              <Field label={t(lang, "displayName")} value={name} onChange={setName} autoComplete="name" />
            )}
            <Field label={t(lang, "email")} type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field
              label={t(lang, "password")}
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={registering ? "new-password" : "current-password"}
            />
            {error && <p className="text-sm text-clay">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 w-full rounded-full bg-ink text-sm font-semibold text-paper disabled:opacity-60"
            >
              {registering ? t(lang, "register") : t(lang, "signIn")}
            </button>
          </form>
        )}
        <div className="mt-8 max-w-md">
          <p className="text-sm text-muted">{t(lang, "orElse")}</p>
          <div className="mt-3 flex flex-col gap-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => {
                  void signIn(p.providerId, { callbackURL: "/desk" }).catch((err: unknown) => {
                    const message = err instanceof Error ? err.message : "";
                    setError(/pop-up|popup/i.test(message) ? t(lang, "popupBlocked") : t(lang, "socialFailed"));
                  });
                }}
                className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <input
        required={type !== "text" || label.length > 0}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-card px-3 text-sm text-fg"
      />
    </label>
  );
}

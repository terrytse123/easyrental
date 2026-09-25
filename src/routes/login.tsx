import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { authEnabled, setBearerToken, setStoredUser } from "@/lib/auth/client";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";

const searchSchema = z.object({
  mode: z.enum(["register", "signin", "reset"]).optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { mode } = Route.useSearch();
  const lang = useRental((s) => s.lang);
  const registering = mode === "register";
  const resetting = mode === "reset";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim().includes("@")) {
      setError(t(lang, "needEmail"));
      return;
    }
    if (password.length < 8) {
      setError(t(lang, "passwordShort"));
      return;
    }
    if ((registering || resetting) && password !== confirm) {
      setError(t(lang, "passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        email: email.trim(),
        password,
        name: name.trim(),
        mode: resetting ? "reset" : registering ? "register" : "signin",
      };
      let response = await fetch("/api/account/open", {
        method: "POST",
        credentials: "include",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        response = await fetch(`/api/account/open?${new URLSearchParams(payload)}`, {
          method: "GET",
          credentials: "include",
          headers: { accept: "application/json" },
        });
      }
      const result = (await response.json()) as {
        ok?: boolean;
        token?: string | null;
        message?: string;
        user?: { id: string; name?: string; email?: string };
      };
      if (!result.ok || !result.token || !result.user?.id) {
        const message = result.message ?? "";
        setError(
          /exist/i.test(message)
            ? t(lang, "emailTaken")
            : /no account/i.test(message)
              ? t(lang, "noAccount")
              : /invalid email or password/i.test(message)
                ? t(lang, "badCredentials")
                : /short/i.test(message)
                  ? t(lang, "passwordShort")
                  : message || t(lang, "authFailed"),
        );
        setBusy(false);
        return;
      }
      setBearerToken(result.token);
      setStoredUser({
        id: result.user.id,
        displayName: result.user.name ?? null,
        primaryEmail: result.user.email ?? payload.email,
        profileImageUrl: null,
        isDevFallback: false,
      });
      window.location.assign("/desk");
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
        <h1 className="font-display text-4xl text-ink">
          {resetting ? t(lang, "resetPassword") : registering ? t(lang, "register") : t(lang, "signIn")}
        </h1>
        <p className="mt-3 text-sm">
          <Link to="/login" search={{ mode: registering || resetting ? "signin" : "register" }} className="text-brass">
            {registering || resetting ? t(lang, "haveAccount") : t(lang, "register")}
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
              autoComplete={registering || resetting ? "new-password" : "current-password"}
            />
            {(registering || resetting) && (
              <Field
                label={t(lang, "passwordConfirm")}
                type="password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />
            )}
            {error && <p className="text-sm text-clay">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 w-full rounded-full bg-ink text-sm font-semibold text-paper disabled:opacity-60"
            >
              {resetting ? t(lang, "resetPassword") : registering ? t(lang, "register") : t(lang, "signIn")}
            </button>
            {!registering && !resetting && (
              <p className="text-sm">
                <Link to="/login" search={{ mode: "reset" }} className="text-brass">
                  {t(lang, "forgotPassword")}
                </Link>
              </p>
            )}
          </form>
        )}
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
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-card px-3 text-sm text-fg"
      />
    </label>
  );
}

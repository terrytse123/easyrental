import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { authEnabled } from "@/lib/auth/client";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";

const searchSchema = z.object({
  mode: z.enum(["register", "signin", "reset", "reset-code", "verify", "mfa"]).optional(),
  error: z.string().optional(),
  email: z.string().optional(),
  challenge: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { mode, error, email, challenge } = Route.useSearch();
  const lang = useRental((s) => s.lang);
  const [busy, setBusy] = useState(false);
  const verifying = mode === "verify";
  const mfa = mode === "mfa";
  const registering = mode === "register";
  const resetting = mode === "reset";
  const resetConfirm = mode === "reset-code";
  const accountMode = verifying
    ? "verify"
    : mfa
      ? "mfa"
      : resetConfirm
        ? "reset-code"
        : resetting
          ? "reset"
          : registering
            ? "register"
            : "signin";

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const body: Record<string, string> = {};
    for (const [key, value] of data.entries()) {
      if (typeof value === "string") body[key] = value.trim();
    }
    if ((accountMode === "register" || accountMode === "reset-code") && body.confirm && body.confirm !== body.password) {
      const query = new URLSearchParams({ mode: accountMode, error: "mismatch" });
      if (body.email) query.set("email", body.email);
      window.location.assign(`/login?${query.toString()}`);
      return;
    }
    if ((accountMode === "register" || accountMode === "reset-code" || accountMode === "signin") && body.password && body.password.length < 8) {
      const query = new URLSearchParams({ mode: accountMode, error: "short" });
      if (body.email) query.set("email", body.email);
      window.location.assign(`/login?${query.toString()}`);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/account/enter", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const signed = (await response.json()) as {
        ok?: boolean;
        message?: string;
        next?: string;
        challenge?: string;
        token?: string;
        user?: { id: string; name: string; email: string };
      };
      if (signed.ok) {
        window.location.assign("/desk");
        return;
      }
      if (signed.next) {
        const query = new URLSearchParams({ mode: signed.next });
        if (body.email) query.set("email", body.email.toLowerCase());
        if (signed.challenge) query.set("challenge", signed.challenge);
        if (/mail failed/i.test(signed.message ?? "")) query.set("error", "mail");
        if (/bad code/i.test(signed.message ?? "")) query.set("error", "code");
        window.location.assign(`/login?${query.toString()}`);
        return;
      }
      const failMode =
        accountMode === "register" || accountMode === "reset" || accountMode === "reset-code" ? accountMode : "signin";
      const err = /no account/i.test(signed.message ?? "")
        ? "missing"
        : /bad code/i.test(signed.message ?? "")
          ? "code"
          : /mail failed/i.test(signed.message ?? "")
            ? "mail"
            : /invalid email or password/i.test(signed.message ?? "")
              ? "bad"
              : /mismatch/i.test(signed.message ?? "")
                ? "mismatch"
                : /short/i.test(signed.message ?? "")
                  ? "short"
                  : /invalid email/i.test(signed.message ?? "")
                    ? "email"
                    : "fail";
      const query = new URLSearchParams({ mode: failMode, error: err });
      if (body.email) query.set("email", body.email.toLowerCase());
      window.location.assign(`/login?${query.toString()}`);
    } catch {
      const query = new URLSearchParams({ mode: accountMode, error: "fail" });
      if (body.email) query.set("email", body.email);
      window.location.assign(`/login?${query.toString()}`);
    } finally {
      setBusy(false);
    }
  }

  const title = verifying
    ? t(lang, "verifyEmail")
    : mfa
      ? t(lang, "mfaTitle")
      : resetting || resetConfirm
        ? t(lang, "resetPassword")
        : registering
          ? t(lang, "register")
          : t(lang, "signIn");

  const submitLabel = verifying || mfa || resetConfirm
    ? t(lang, "confirmCode")
    : resetting
      ? t(lang, "sendResetCode")
      : accountMode === "signin"
        ? t(lang, "signIn")
        : t(lang, "saveAccount");

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
        <h1 className="font-display text-4xl text-ink">{title}</h1>
        <p className="mt-3 text-sm">
          {verifying || mfa ? (
            <Link to="/login" search={{ mode: "signin" }} className="text-brass">
              {t(lang, "signIn")}
            </Link>
          ) : (
            <Link
              to="/login"
              search={{ mode: registering || resetting || resetConfirm ? "signin" : "register" }}
              className="text-brass"
            >
              {registering || resetting || resetConfirm ? t(lang, "haveAccount") : t(lang, "register")}
            </Link>
          )}
        </p>
        {!authEnabled ? (
          <p className="mt-6 text-sm text-muted">{t(lang, "authFailed")}</p>
        ) : (
          <form
            id="account-form"
            noValidate
            className="mt-8 max-w-md space-y-4"
            action="/api/account/enter"
            method="post"
            onSubmit={submitAccount}
          >
            <input type="hidden" name="mode" value={accountMode} />
            {challenge ? <input type="hidden" name="challenge" value={challenge} /> : null}
            {registering && <Plain label={t(lang, "displayName")} name="name" autoComplete="name" />}
            {!mfa && (
              <Plain label={t(lang, "email")} name="email" type="email" autoComplete="username" defaultValue={email ?? ""} />
            )}
            {(verifying || mfa || resetConfirm) && (
              <Plain label={t(lang, "verifyCode")} name="code" type="text" autoComplete="one-time-code" />
            )}
            {!verifying && !mfa && !resetting && (
              <Plain
                label={resetConfirm ? t(lang, "newPassword") : t(lang, "password")}
                name="password"
                type="password"
                autoComplete={accountMode === "signin" ? "current-password" : "new-password"}
              />
            )}
            {(registering || resetConfirm) && (
              <Plain label={t(lang, "passwordConfirm")} name="confirm" type="password" autoComplete="new-password" />
            )}
            {resetting && <p className="text-sm text-muted">{t(lang, "resetHint")}</p>}
            {resetConfirm && error !== "mail" && (
              <p className="text-sm text-muted">
                {t(lang, "verifyHint")} {email}
              </p>
            )}
            {verifying && error !== "mail" && (
              <p className="text-sm text-muted">
                {t(lang, "verifyHint")} {email}
              </p>
            )}
            {mfa && <p className="text-sm text-muted">{t(lang, "mfaHint")}</p>}
            {registering && <p className="text-sm text-muted">{t(lang, "registerHint")}</p>}
            {error && <p className="text-sm text-clay">{notice(error, email)}</p>}
            <button
              id="save-account"
              type="submit"
              disabled={busy}
              className="min-h-11 w-full rounded-full bg-ink text-sm font-semibold text-paper disabled:opacity-60"
            >
              {submitLabel}
            </button>
            {verifying && email && (
              <p className="text-sm">
                <a className="text-brass" href={`/api/account/enter?page=1&mode=resend&email=${encodeURIComponent(email)}`}>
                  {t(lang, "resendCode")}
                </a>
              </p>
            )}
            {resetConfirm && email && (
              <p className="text-sm">
                <a className="text-brass" href={`/login?mode=reset&email=${encodeURIComponent(email)}`}>
                  {t(lang, "resendCode")}
                </a>
              </p>
            )}
            {!registering && !resetting && !resetConfirm && !verifying && !mfa && (
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

function notice(error: string, email?: string) {
  if (error === "missing") return `沒有這個戶口${email ? `：${email}` : ""}。請先開戶口。`;
  if (error === "bad") return "電郵或密碼不正確。";
  if (error === "exists") return "這個電郵已經開過戶。請用登入。";
  if (error === "mismatch") return "兩次密碼不相同。";
  if (error === "short") return "密碼至少 8 個字。";
  if (error === "code") return "驗證碼不正確或已過期。";
  if (error === "mail") return "驗證電郵未能寄出。請在 Vercel 設定寄件後按重寄。";
  if (error === "email") return "請輸入電郵。";
  return "未能登入。";
}

function Plain({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-card px-3 text-sm text-fg"
      />
    </label>
  );
}

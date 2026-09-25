import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent } from "react";
import { z } from "zod";
import { authEnabled } from "@/lib/auth/client";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";

const searchSchema = z.object({
  mode: z.enum(["register", "signin", "reset"]).optional(),
  error: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { mode, error, email } = Route.useSearch();
  const lang = useRental((s) => s.lang);
  const registering = mode === "register";
  const resetting = mode === "reset";
  const accountMode = resetting ? "reset" : registering ? "register" : "signin";

  function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (typeof value === "string") params.set(key, value.trim());
    }
    window.location.assign(`/api/account/enter?${params.toString()}`);
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
          <form
            id="account-form"
            noValidate
            className="mt-8 max-w-md space-y-4"
            action="/api/account/enter"
            method="get"
            onSubmit={submitAccount}
          >
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="mode" value={accountMode} />
            {registering && <Plain label={t(lang, "displayName")} name="name" autoComplete="name" />}
            <Plain label={t(lang, "email")} name="email" type="email" autoComplete="username" defaultValue={email ?? ""} />
            <Plain
              label={t(lang, "password")}
              name="password"
              type="password"
              autoComplete={accountMode === "signin" ? "current-password" : "new-password"}
            />
            {(registering || resetting) && (
              <Plain label={t(lang, "passwordConfirm")} name="confirm" type="password" autoComplete="new-password" />
            )}
            {error && <p className="text-sm text-clay">{notice(error, email)}</p>}
            <button id="save-account" type="submit" className="min-h-11 w-full rounded-full bg-ink text-sm font-semibold text-paper">
              {accountMode === "signin" ? "登入" : "儲存戶口"}
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

function notice(error: string, email?: string) {
  if (error === "missing") return `沒有這個戶口${email ? `：${email}` : ""}。請先開戶口。`;
  if (error === "bad") return "電郵或密碼不正確。";
  if (error === "exists") return "這個電郵已經開過戶。請用登入。";
  if (error === "mismatch") return "兩次密碼不相同。";
  if (error === "short") return "密碼至少 8 個字。";
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

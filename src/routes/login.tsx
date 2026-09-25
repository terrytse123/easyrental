import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { authEnabled } from "@/lib/auth/client";
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
  const accountMode = resetting ? "reset" : registering ? "register" : "signin";

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
          <form id="account-form" className="mt-8 max-w-md space-y-4" onSubmit={(event) => event.preventDefault()}>
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="mode" value={accountMode} />
            {registering && <Plain label={t(lang, "displayName")} name="name" autoComplete="name" />}
            <Plain label={t(lang, "email")} name="email" type="email" autoComplete="email" />
            <Plain
              label={t(lang, "password")}
              name="password"
              type="password"
              autoComplete={registering || resetting ? "new-password" : "current-password"}
            />
            {(registering || resetting) && (
              <Plain label={t(lang, "passwordConfirm")} name="confirm" type="password" autoComplete="new-password" />
            )}
            <button
              type="button"
              onClick={() => {
                const form = document.getElementById("account-form");
                if (!(form instanceof HTMLFormElement)) return;
                const params = new URLSearchParams(new FormData(form));
                const password = String(params.get("password") ?? "");
                const confirm = String(params.get("confirm") ?? "");
                const email = String(params.get("email") ?? "").trim();
                if (!email.includes("@")) {
                  window.alert("請輸入電郵。");
                  return;
                }
                if (password.length < 8) {
                  window.alert("密碼至少 8 個字。");
                  return;
                }
                if (confirm && confirm !== password) {
                  window.alert("兩次密碼不相同。");
                  return;
                }
                params.set("email", email);
                params.set("confirm", confirm || password);
                params.set("page", "1");
                window.location.assign(`/api/account/open?${params.toString()}`);
              }}
              className="min-h-11 w-full rounded-full bg-ink text-sm font-semibold text-paper"
            >
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

function Plain({
  label,
  name,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-card px-3 text-sm text-fg"
      />
    </label>
  );
}

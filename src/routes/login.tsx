import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
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

function sendAccountForm() {
  const form = document.getElementById("account-form");
  if (!(form instanceof HTMLFormElement)) return;
  const params = new URLSearchParams();
  for (const el of form.elements) {
    if (el instanceof HTMLInputElement && el.name) params.set(el.name, el.value.trim());
  }
  if (!params.get("confirm")) params.set("confirm", params.get("password") ?? "");
  params.set("page", "1");
  window.location.href = `/api/account/open?${params.toString()}`;
}

function LoginPage() {
  const { mode } = Route.useSearch();
  const lang = useRental((s) => s.lang);
  const registering = mode === "register";
  const resetting = mode === "reset";
  const accountMode = resetting ? "reset" : registering ? "register" : "signin";

  useEffect(() => {
    const form = document.getElementById("account-form");
    const button = document.getElementById("save-account");
    const onSubmit = (event: Event) => {
      event.preventDefault();
      sendAccountForm();
    };
    form?.addEventListener("submit", onSubmit);
    button?.addEventListener("click", onSubmit);
    return () => {
      form?.removeEventListener("submit", onSubmit);
      button?.removeEventListener("click", onSubmit);
    };
  }, [accountMode]);

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
          <form id="account-form" noValidate className="mt-8 max-w-md space-y-4">
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="mode" value={accountMode} />
            {registering && <Plain label={t(lang, "displayName")} name="name" autoComplete="name" />}
            <Plain label={t(lang, "email")} name="email" type="text" autoComplete="email" />
            <Plain
              label={t(lang, "password")}
              name="password"
              type="password"
              autoComplete={registering || resetting ? "new-password" : "current-password"}
            />
            {(registering || resetting) && (
              <Plain label={t(lang, "passwordConfirm")} name="confirm" type="password" autoComplete="new-password" />
            )}
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
  const accountMode = resetting ? "reset" : registering ? "register" : "signin";
  const [status, setStatus] = useState("");
  const timer = useRef(0);
  const attempt = useRef(0);

  useEffect(() => {
    window.clearTimeout(timer.current);
    setStatus("");
  }, [accountMode]);

  function schedule(event: FormEvent<HTMLFormElement>) {
    if (accountMode === "signin") return;
    const form = event.currentTarget;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void save(form);
    }, 600);
  }

  async function save(form: HTMLFormElement) {
    window.clearTimeout(timer.current);
    const id = ++attempt.current;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "").trim();
    const confirm = String(data.get("confirm") ?? "");
    const name = String(data.get("name") ?? "").trim();
    const modeSent = accountMode;
    if (!email.includes("@") || password.length < 8) {
      setStatus("請輸入電郵，密碼至少 8 個字。");
      return;
    }
    if (modeSent !== "signin" && confirm !== password) {
      setStatus(confirm ? "兩次密碼不相同。" : "請再輸入一次密碼。");
      return;
    }
    setStatus(modeSent === "signin" ? "正在登入…" : "正在儲存到資料庫…");
    try {
      const params = new URLSearchParams({
        email,
        password,
        name,
        confirm: confirm || password,
        mode: modeSent,
      });
      const response = await fetch(`/api/account/open?${params.toString()}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
        credentials: "include",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        token?: string;
        message?: string;
        user?: { id: string; name?: string; email?: string };
      };
      if (id !== attempt.current) return;
      if (!result.ok || !result.token || !result.user?.id) {
        const message = result.message ?? "";
        setStatus(
          /no account/i.test(message)
            ? "沒有這個戶口。請先開戶口。"
            : modeSent === "signin" || /invalid email or password/i.test(message)
              ? "電郵或密碼不正確。"
              : message || "未能儲存。",
        );
        return;
      }
      setBearerToken(result.token);
      setStoredUser({
        id: result.user.id,
        displayName: result.user.name ?? null,
        primaryEmail: result.user.email ?? email,
        profileImageUrl: null,
        isDevFallback: false,
      });
      window.location.href = "/desk";
    } catch (error) {
      if (id !== attempt.current) return;
      setStatus(error instanceof Error ? error.message : "未能儲存。");
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
          <form
            id="account-form"
            noValidate
            className="mt-8 max-w-md space-y-4"
            onInput={schedule}
            onSubmit={(event) => {
              event.preventDefault();
              void save(event.currentTarget);
            }}
          >
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="mode" value={accountMode} />
            {registering && <Plain label={t(lang, "displayName")} name="name" autoComplete="name" />}
            <Plain label={t(lang, "email")} name="email" type="text" autoComplete="off" />
            <Plain
              label={t(lang, "password")}
              name="password"
              type="password"
              autoComplete="off"
            />
            {accountMode === "signin" && (
              <a
                className="flex min-h-11 w-full items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper"
                href="/api/account/open"
              >
                用 easyrental 進入帳簿
              </a>
            )}
            {(registering || resetting) && (
              <Plain label={t(lang, "passwordConfirm")} name="confirm" type="password" autoComplete="new-password" />
            )}
            <p className="text-sm text-clay">{status}</p>
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

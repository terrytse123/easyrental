import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/rental/shell";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";

export const Route = createFileRoute("/security")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : undefined,
    ok: typeof search.ok === "string" ? search.ok : undefined,
  }),
  component: SecurityPage,
});

type SecurityInfo = {
  ok: boolean;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
  secret?: string | null;
  otpauth?: string | null;
  qr?: string | null;
};

function SecurityPage() {
  const lang = useRental((s) => s.lang);
  const { error, ok } = Route.useSearch();
  const [info, setInfo] = useState<SecurityInfo | null>(null);

  useEffect(() => {
    void fetch("/api/account/enter?mode=security", { credentials: "include" })
      .then((response) => response.json() as Promise<SecurityInfo>)
      .then(setInfo)
      .catch(() => setInfo({ ok: false }));
  }, [ok, error]);

  return (
    <Shell>
      <h1 className="font-display text-4xl text-ink">{t(lang, "settingsTitle")}</h1>
      {!info ? <p className="mt-6 text-sm text-muted">{t(lang, "ledgerLoading")}</p> : null}
      {info && !info.ok ? <p className="mt-6 text-sm text-clay">{t(lang, "authFailed")}</p> : null}
      {info?.ok ? (
        <div className="mt-6 max-w-lg space-y-8 text-sm">
          {ok === "profile" ? <p className="text-brass">{t(lang, "profileSaved")}</p> : null}
          {ok === "password" ? <p className="text-brass">{t(lang, "passwordSaved")}</p> : null}
          {ok === "1" ? <p className="text-brass">{t(lang, "mfaOn")}</p> : null}
          {error === "name" ? <p className="text-clay">{t(lang, "nameRequired")}</p> : null}
          {error === "bad" ? <p className="text-clay">{t(lang, "badCredentials")}</p> : null}
          {error === "short" ? <p className="text-clay">{t(lang, "passwordShort")}</p> : null}
          {error === "mismatch" ? <p className="text-clay">{t(lang, "passwordMismatch")}</p> : null}
          {error === "code" ? <p className="text-clay">驗證碼不正確或已過期。</p> : null}

          <section className="space-y-3">
            <h2 className="font-display text-2xl text-ink">{t(lang, "settingsProfile")}</h2>
            <form method="get" action="/api/account/enter" className="space-y-3">
              <input type="hidden" name="mode" value="profile" />
              <label className="block text-muted">
                {t(lang, "displayName")}
                <input name="name" defaultValue={info.name ?? ""} autoComplete="name" className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-card px-3 text-fg" />
              </label>
              <p className="text-muted">{info.email}</p>
              <p className="text-muted">{t(lang, "emailFixed")}</p>
              <button type="submit" className="min-h-11 rounded-full bg-ink px-5 font-semibold text-paper">
                {t(lang, "saveProfile")}
              </button>
            </form>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl text-ink">{t(lang, "settingsPassword")}</h2>
            <form method="post" action="/api/account/enter" className="space-y-3">
              <input type="hidden" name="mode" value="password" />
              <label className="block text-muted">
                {t(lang, "currentPassword")}
                <input name="password" type="password" autoComplete="current-password" className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-card px-3 text-fg" />
              </label>
              <label className="block text-muted">
                {t(lang, "newPassword")}
                <input name="next" type="password" autoComplete="new-password" className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-card px-3 text-fg" />
              </label>
              <label className="block text-muted">
                {t(lang, "passwordConfirm")}
                <input name="confirm" type="password" autoComplete="new-password" className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-card px-3 text-fg" />
              </label>
              {info.mfaEnabled ? (
                <label className="block text-muted">
                  {t(lang, "verifyCode")}
                  <input name="code" inputMode="numeric" autoComplete="one-time-code" className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-card px-3 text-fg" />
                </label>
              ) : null}
              <button type="submit" className="min-h-11 rounded-full bg-ink px-5 font-semibold text-paper">
                {t(lang, "settingsPassword")}
              </button>
            </form>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl text-ink">{t(lang, "mfaTitle")}</h2>
            <p>{info.mfaEnabled ? t(lang, "mfaOn") : t(lang, "mfaOff")}</p>
          {!info.mfaEnabled && !info.secret ? (
            <form method="get" action="/api/account/enter">
              <input type="hidden" name="mode" value="mfa-start" />
              <button type="submit" className="min-h-11 rounded-full bg-ink px-5 font-semibold text-paper">
                {t(lang, "mfaStart")}
              </button>
            </form>
          ) : null}
          {!info.mfaEnabled && info.secret ? (
            <form method="get" action="/api/account/enter" className="space-y-3">
              <input type="hidden" name="mode" value="mfa-confirm" />
              <p className="text-muted">{t(lang, "mfaSecret")}</p>
              {info.qr ? (
                <img
                  src={info.qr}
                  alt="Authenticator QR code"
                  width={280}
                  height={280}
                  className="h-64 w-64 rounded-2xl bg-white p-3"
                />
              ) : null}
              <p className="break-all rounded-2xl bg-card px-3 py-2 font-mono text-ink">{info.secret}</p>
              <label className="block text-muted">
                {t(lang, "verifyCode")}
                <input name="code" inputMode="numeric" autoComplete="one-time-code" className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-card px-3 text-fg" />
              </label>
              <button type="submit" className="min-h-11 rounded-full bg-ink px-5 font-semibold text-paper">
                {t(lang, "mfaConfirm")}
              </button>
            </form>
          ) : null}
          {info.mfaEnabled ? (
            <form method="get" action="/api/account/enter" className="space-y-3">
              <input type="hidden" name="mode" value="mfa-off" />
              <label className="block text-muted">
                {t(lang, "verifyCode")}
                <input name="code" inputMode="numeric" autoComplete="one-time-code" className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-card px-3 text-fg" />
              </label>
              <button type="submit" className="min-h-11 rounded-full border border-line px-5 font-semibold text-ink">
                {t(lang, "mfaDisable")}
              </button>
            </form>
          ) : null}
          </section>
        </div>
      ) : null}
    </Shell>
  );
}

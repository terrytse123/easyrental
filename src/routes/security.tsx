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
  email?: string;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
  secret?: string | null;
  otpauth?: string | null;
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
      <h1 className="font-display text-4xl text-ink">{t(lang, "mfaTitle")}</h1>
      {!info ? <p className="mt-6 text-sm text-muted">{t(lang, "ledgerLoading")}</p> : null}
      {info && !info.ok ? <p className="mt-6 text-sm text-clay">{t(lang, "authFailed")}</p> : null}
      {info?.ok ? (
        <div className="mt-6 max-w-lg space-y-4 text-sm">
          <p className="text-muted">{info.email}</p>
          <p>{info.mfaEnabled ? t(lang, "mfaOn") : t(lang, "mfaOff")}</p>
          {ok ? <p className="text-brass">{t(lang, "mfaOn")}</p> : null}
          {error === "code" ? <p className="text-clay">驗證碼不正確或已過期。</p> : null}
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
              <p className="break-all rounded-2xl bg-card px-3 py-2 font-mono text-ink">{info.secret}</p>
              {info.otpauth ? (
                <a className="block break-all text-brass" href={info.otpauth}>
                  {info.otpauth}
                </a>
              ) : null}
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
        </div>
      ) : null}
    </Shell>
  );
}

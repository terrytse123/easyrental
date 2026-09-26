import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Building2, Hammer, Home, Receipt, ScrollText, Wallet } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { authClient, getBearerToken, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";

const links = [
  { to: "/desk", key: "navHome", icon: Home },
  { to: "/properties", key: "navProperties", icon: Building2 },
  { to: "/tenancies", key: "navTenancies", icon: ScrollText },
  { to: "/ledger", key: "navLedger", icon: Receipt },
  { to: "/income", key: "navIncome", icon: Wallet },
  { to: "/repairs", key: "navRepairs", icon: Hammer },
] as const;

function active(path: string, to: string) {
  return to === "/desk" ? path === "/desk" : path.startsWith(to);
}

export function Shell({ children }: { children: ReactNode }) {
  const lang = useRental((s) => s.lang);
  const setLang = useRental((s) => s.setLang);
  const setHydrated = useRental((s) => s.setHydrated);
  const loaded = useRental((s) => s.loaded);
  const loadedFor = useRental((s) => s.loadedFor);
  const loadError = useRental((s) => s.loadError);
  const saveState = useRental((s) => s.saveState);
  const loadLedger = useRental((s) => s.loadLedger);
  const reloadLedger = useRental((s) => s.reloadLedger);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    void Promise.resolve(useRental.persist.rehydrate()).then(() => setHydrated(true));
  }, [setHydrated]);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
  }, [lang]);

  useEffect(() => {
    if (!user && getBearerToken()) void authClient.getSession();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (loaded && loadedFor === user.id) return;
    void loadLedger(user.id);
  }, [user, loaded, loadedFor, loadLedger]);

  if (isPending || (getBearerToken() && !user) || (user && !loaded && !loadError)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper px-6 text-fg">
        <div className="text-center">
          <p className="text-sm text-muted">{t(lang, "ledgerLoading")}</p>
          <button type="button" onClick={() => void signOut("/login")} className="mt-4 text-sm text-brass">
            {t(lang, "signOut")}
          </button>
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (loadError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper px-6 text-center text-fg">
        <div>
          <p className="text-sm text-muted">{t(lang, "ledgerLoadFail")}</p>
          <button
            type="button"
            onClick={() => void loadLedger(user.id)}
            className="mt-4 min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-paper"
          >
            {t(lang, "retry")}
          </button>
          <button type="button" onClick={() => void signOut("/login")} className="mt-4 block w-full text-sm text-brass">
            {t(lang, "signOut")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper text-fg">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-ink px-4 py-6 text-paper md:flex">
          <Link to="/desk" className="px-2">
            <p className="font-display text-3xl leading-none">{t(lang, "brand")}</p>
            <p className="mt-2 text-sm text-brass-soft">{t(lang, "brandEn")}</p>
          </Link>
          <p className="mt-4 px-2 text-sm leading-relaxed text-paper/70">{t(lang, "tagline")}</p>
          <nav className="mt-8 flex flex-col gap-1">
            {links.map((item) => {
              const on = active(path, item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm ${
                    on ? "bg-brass text-paper" : "text-paper/80 hover:bg-ink-soft"
                  }`}
                >
                  <Icon className="size-4" />
                  {t(lang, item.key)}
                </Link>
              );
            })}
            <Link
              to="/guide"
              className={`mt-4 flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm ${
                path.startsWith("/guide") ? "bg-brass text-paper" : "text-paper/80 hover:bg-ink-soft"
              }`}
            >
              <BookOpen className="size-4" />
              {t(lang, "navGuide")}
            </Link>
            <Link to="/" className="mt-2 flex min-h-11 items-center rounded-2xl px-3 text-sm text-paper/70 hover:bg-ink-soft">
              {t(lang, "marketHome")}
            </Link>
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:px-8">
            <div className="min-w-0 md:hidden">
              <Link to="/desk" className="font-display text-xl leading-none text-ink">
                {t(lang, "brand")}
              </Link>
              <p className="truncate text-xs text-muted">{t(lang, "tagline")}</p>
            </div>
            <p className="hidden text-sm text-muted md:block">{t(lang, "homeIntro")}</p>
            <div className="flex items-center gap-2">
              <Link to="/" className="hidden min-h-11 items-center text-sm text-brass md:flex">
                {t(lang, "marketHome")}
              </Link>
              <Link to="/security" className="flex min-h-11 items-center text-sm text-brass">
                {t(lang, "navSecurity")}
              </Link>
              <button
                type="button"
                onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink"
              >
                {t(lang, "lang")}
              </button>
              <div className="max-w-36 overflow-hidden sm:max-w-none">
                <UserButton />
              </div>
            </div>
          </header>
          {saveState === "error" && (
            <p className="bg-clay-soft px-4 py-2 text-sm text-clay md:px-8">{t(lang, "saveFailed")}</p>
          )}
          {saveState === "conflict" && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-clay-soft px-4 py-2 text-sm text-clay md:px-8">
              <p>{t(lang, "saveConflict")}</p>
              <button
                type="button"
                onClick={() => void reloadLedger()}
                className="min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-paper"
              >
                {t(lang, "reloadLedger")}
              </button>
            </div>
          )}
          <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-12">{children}</main>
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-card md:hidden">
        {links.map((item) => {
          const on = active(path, item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${
                on ? "text-brass" : "text-muted"
              }`}
            >
              <Icon className="size-5" />
              {t(lang, item.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

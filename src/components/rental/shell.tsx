import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Building2, Hammer, Home, Receipt, ScrollText } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";

const links = [
  { to: "/", key: "navHome", icon: Home },
  { to: "/properties", key: "navProperties", icon: Building2 },
  { to: "/tenancies", key: "navTenancies", icon: ScrollText },
  { to: "/ledger", key: "navLedger", icon: Receipt },
  { to: "/repairs", key: "navRepairs", icon: Hammer },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const lang = useRental((s) => s.lang);
  const setLang = useRental((s) => s.setLang);
  const setHydrated = useRental((s) => s.setHydrated);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    void Promise.resolve(useRental.persist.rehydrate()).then(() => setHydrated(true));
  }, [setHydrated]);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
  }, [lang]);

  return (
    <div className="min-h-dvh bg-paper text-fg">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-ink px-4 py-6 text-paper md:flex">
          <Link to="/" className="px-2">
            <p className="font-display text-3xl leading-none">{t(lang, "brand")}</p>
            <p className="mt-2 text-sm text-brass-soft">{t(lang, "brandEn")}</p>
          </Link>
          <p className="mt-4 px-2 text-sm leading-relaxed text-paper/70">{t(lang, "tagline")}</p>
          <nav className="mt-8 flex flex-col gap-1">
            {links.map((item) => {
              const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm ${
                    active ? "bg-brass text-paper" : "text-paper/80 hover:bg-ink-soft"
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
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:px-8">
            <div className="min-w-0 md:hidden">
              <p className="font-display text-xl leading-none text-ink">{t(lang, "brand")}</p>
              <p className="truncate text-xs text-muted">{t(lang, "tagline")}</p>
            </div>
            <p className="hidden text-sm text-muted md:block">{t(lang, "homeIntro")}</p>
            <div className="flex items-center gap-2">
              <Link
                to="/guide"
                className="grid size-11 place-items-center rounded-full border border-line bg-card text-ink md:hidden"
                aria-label={t(lang, "navGuide")}
              >
                <BookOpen className="size-4" />
              </Link>
              <button
                type="button"
                onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink"
              >
                {t(lang, "lang")}
              </button>
            </div>
          </header>
          <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-12">{children}</main>
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card md:hidden">
        {links.map((item) => {
          const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${
                active ? "text-brass" : "text-muted"
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

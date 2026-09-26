import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { DISTRICTS } from "@/lib/rental/hk";
import { t } from "@/lib/rental/i18n";
import { hkd } from "@/lib/rental/format";
import { getRentIndex } from "@/lib/rental/index.functions";
import {
  CLASSES,
  INDEX_YEAR,
  LATEST_RENTS,
  RENT_INDEX,
  classFromSqft,
  estimateRent,
  indexChange,
  perSqftFromSqm,
  regionOf,
  type RentClass,
  type RentIndexPoint,
  type RentRegion,
} from "@/lib/rental/market";
import { useRental } from "@/lib/rental/store";

export const Route = createFileRoute("/")({ component: MarketHome });

const REGIONS: { id: RentRegion; zh: string; en: string }[] = [
  { id: "hk", zh: "港島", en: "Hong Kong" },
  { id: "kln", zh: "九龍", en: "Kowloon" },
  { id: "nt", zh: "新界", en: "New Territories" },
];

function MarketHome() {
  const lang = useRental((s) => s.lang);
  const setLang = useRental((s) => s.setLang);
  const setHydrated = useRental((s) => s.setHydrated);
  const { user, isPending } = useCurrentUserState();
  const [district, setDistrict] = useState("Central and Western");
  const [sqft, setSqft] = useState("500");
  const [points, setPoints] = useState<RentIndexPoint[]>(RENT_INDEX);
  const [indexSource, setIndexSource] = useState<"pending" | "rvd" | "fallback">("pending");
  const change = indexChange(points);
  const area = Number(sqft);
  const rentClass: RentClass = Number.isFinite(area) && area > 0 ? classFromSqft(area) : "B";
  const region = regionOf(district);
  const estimate = Number.isFinite(area) && area > 0 ? estimateRent(area, region, rentClass) : null;
  const band = CLASSES.find((c) => c.id === rentClass);
  const districtRow = DISTRICTS.find((d) => d.id === district);
  const regionLabel = REGIONS.find((r) => r.id === region);

  const series = useMemo(
    () =>
      points.map((row) => ({
        label: lang === "zh" ? `${Number(row.ym.slice(5))}月` : row.ym.slice(2),
        value: row.value,
        provisional: row.provisional,
      })),
    [lang, points],
  );
  const yDomain = useMemo(() => {
    const values = points.map((row) => row.value);
    const low = Math.floor(Math.min(...values) - 2);
    const high = Math.ceil(Math.max(...values) + 2);
    return [low, high] as [number, number];
  }, [points]);

  useEffect(() => {
    void Promise.resolve(useRental.persist.rehydrate()).then(() => setHydrated(true));
  }, [setHydrated]);

  useEffect(() => {
    let cancelled = false;
    void getRentIndex()
      .then((feed) => {
        if (cancelled || feed.series.length < 6) return;
        setPoints(feed.series);
        setIndexSource(feed.source);
      })
      .catch(() => {
        if (!cancelled) setIndexSource("fallback");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
  }, [lang]);

  return (
    <div className="min-h-dvh bg-paper text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div>
            <p className="font-display text-2xl leading-none text-ink">{t(lang, "brand")}</p>
            <p className="mt-1 text-xs text-muted">{t(lang, "brandEn")}</p>
            <a className="mt-1 block text-xs font-semibold text-brass" href="/EasyRentalHK-117.apk" download="EasyRentalHK.apk">
              {lang === "zh" ? "下載 Android 版" : "Download Android app"}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink"
            >
              {t(lang, "lang")}
            </button>
            {isPending ? (
              <div className="h-11 w-24 animate-pulse rounded-full bg-line" />
            ) : user ? (
              <div className="flex items-center gap-2">
                <Link to="/desk" className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-semibold text-paper">
                  {t(lang, "myLedger")}
                </Link>
                <div className="hidden sm:block">
                  <UserButton />
                </div>
              </div>
            ) : (
              <>
                <Link to="/login" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-ink">
                  {t(lang, "signIn")}
                </Link>
                <Link to="/login" search={{ mode: "register" }} className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-semibold text-paper">
                  {t(lang, "register")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <section className="grid items-stretch gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-card bg-ink p-6 text-paper md:p-8">
            <p className="text-sm text-brass-soft">{t(lang, "marketKicker")}</p>
            <h1 className="font-display mt-3 text-4xl leading-tight md:text-5xl">{t(lang, "marketTitle")}</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-paper/75">{t(lang, "marketLead")}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <IndexStat label={t(lang, "indexNow")} value={change.last.value.toFixed(1)} hint={change.last.provisional ? `${change.last.ym} · ${t(lang, "provisional")}` : change.last.ym} />
              <IndexStat
                label={t(lang, "vsYear")}
                value={`${change.pct >= 0 ? "+" : ""}${change.pct.toFixed(1)}%`}
                hint={`${change.first.ym} → ${change.last.ym}`}
              />
              <IndexStat label={`2025 ${t(lang, "yearAvg")}`} value={INDEX_YEAR.y2025.toFixed(1)} hint={`2024 ${INDEX_YEAR.y2024.toFixed(1)}`} />
            </div>
          </div>

          <form className="rounded-card border border-line bg-card p-5 md:p-6" onSubmit={(e) => e.preventDefault()}>
            <h2 className="font-display text-2xl text-ink">{t(lang, "searchTitle")}</h2>
            <label className="mt-4 block text-sm text-muted" htmlFor="district">
              {t(lang, "district")}
            </label>
            <select
              id="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm"
            >
              {DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {lang === "zh" ? d.zh : d.id}
                </option>
              ))}
            </select>
            <label className="mt-4 block text-sm text-muted" htmlFor="sqft">
              {t(lang, "saleable")}
            </label>
            <input
              id="sqft"
              inputMode="numeric"
              value={sqft}
              onChange={(e) => setSqft(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
              className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm"
            />
            <p className="mt-3 text-sm text-muted">
              {t(lang, "classOf")} · {lang === "zh" ? band?.zh : band?.en}
              <span className="block">{lang === "zh" ? band?.hintZh : band?.hintEn}</span>
            </p>
            {estimate && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-sm text-muted">
                  {lang === "zh" ? districtRow?.zh : district} · {lang === "zh" ? regionLabel?.zh : regionLabel?.en}
                </p>
                <p className="mt-1 text-sm text-muted">{t(lang, "estimate")}</p>
                <p className="font-display mt-1 text-4xl tabular-nums text-ink">{hkd(estimate.monthly, lang)}</p>
                <p className="mt-2 text-sm text-muted">
                  {t(lang, "perSqm")} {hkd(estimate.perSqft, lang)}
                </p>
                {estimate.thin && <p className="mt-2 text-sm text-clay">{t(lang, "thinNote")}</p>}
              </div>
            )}
          </form>
        </section>

        <p className="mt-4 text-sm leading-relaxed text-muted">{t(lang, "regionNote")}</p>

        <section className="mt-8 rounded-card border border-line bg-card p-4 md:p-6">
          <h2 className="font-display text-2xl text-ink">{t(lang, "trendTitle")}</h2>
          <p className="mt-1 text-sm text-muted">1999 = 100 · {t(lang, "indexSchedule")}</p>
          {indexSource === "fallback" && <p className="mt-1 text-sm text-clay">{t(lang, "indexFallback")}</p>}
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1} />
                <YAxis domain={yDomain} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  formatter={(value) => [Number(value).toFixed(1), t(lang, "indexNow")]}
                  cursor={{ stroke: "var(--color-line)" }}
                />
                <Line type="monotone" dataKey="value" stroke="var(--color-brass)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-2xl text-ink">{t(lang, "compareTitle")}</h2>
          <p className="mt-1 text-sm text-muted">
            {lang === "zh" ? band?.zh : band?.en} · 2026-04
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {REGIONS.map((r) => (
              <div key={r.id} className={`rounded-card border p-4 ${r.id === region ? "border-brass bg-brass-soft" : "border-line bg-card"}`}>
                <p className="text-sm text-muted">{lang === "zh" ? r.zh : r.en}</p>
                <p className="font-display mt-2 text-3xl tabular-nums text-ink">{hkd(perSqftFromSqm(LATEST_RENTS[rentClass][r.id]), lang)}</p>
                {LATEST_RENTS[rentClass].thin.includes(r.id) && (
                  <p className="mt-1 text-sm text-clay">{t(lang, "thinNote")}</p>
                )}
                <p className="mt-1 text-sm text-muted">{t(lang, "perSqm")}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-card bg-ink px-5 py-6 text-paper md:flex md:items-center md:justify-between md:px-7">
          <div>
            <h2 className="font-display text-3xl">{t(lang, "openAccount")}</h2>
            <p className="mt-2 max-w-lg text-sm text-paper/75">{t(lang, "marketLead")}</p>
          </div>
          {!isPending && !user && (
            <Link to="/login" search={{ mode: "register" }} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brass px-5 text-sm font-semibold text-paper md:mt-0">
              {t(lang, "register")}
            </Link>
          )}
        </section>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          {t(lang, "sourceNote")}{" "}
          <a className="text-brass underline-offset-2 hover:underline" href="https://www.rvd.gov.hk/en/property_market_statistics/index.html">
            rvd.gov.hk
          </a>
        </p>
      </main>
    </div>
  );
}

function IndexStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="text-sm text-paper/60">{label}</p>
      <p className="font-display mt-1 text-3xl tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-paper/50">{hint}</p>
    </div>
  );
}

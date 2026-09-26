import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Shell } from "@/components/rental/shell";
import { Money, Pill } from "@/components/rental/ui";
import { DISTRICTS } from "@/lib/rental/hk";
import { t } from "@/lib/rental/i18n";
import { daysUntil, hkd, monthKey, paymentState, RENEW_WITHIN_DAYS } from "@/lib/rental/format";
import { notifyRenewals, sendRenewalTest } from "@/lib/rental/renewal.functions";
import { useRental } from "@/lib/rental/store";

export const Route = createFileRoute("/desk")({ component: Desk });

function Desk() {
  const lang = useRental((s) => s.lang);
  const properties = useRental((s) => s.properties);
  const tenancies = useRental((s) => s.tenancies);
  const payments = useRental((s) => s.payments);
  const tickets = useRental((s) => s.tickets);
  const tenants = useRental((s) => s.tenants);
  const month = monthKey();

  const occupiedIds = new Set(tenancies.filter((x) => x.active).map((x) => x.propertyId));
  const monthPays = payments.filter((p) => p.period === month);
  const expected = monthPays.reduce((a, p) => a + p.amount, 0);
  const collected = monthPays.reduce((a, p) => a + Math.min(p.paidAmount, p.amount), 0);
  const overdue = payments.filter((p) => paymentState(p) === "overdue");
  const expiring = tenancies.filter((x) => x.active && daysUntil(x.end) >= 0 && daysUntil(x.end) <= RENEW_WITHIN_DAYS);
  const renewals = tenancies
    .filter((x) => x.active && daysUntil(x.end) <= RENEW_WITHIN_DAYS)
    .sort((a, b) => a.end.localeCompare(b.end));
  const open = tickets.filter((k) => k.status !== "done");

  const chart = ["2026-07", "2026-08", "2026-09", "2026-10"].map((period) => {
    const rows = payments.filter((p) => p.period === period);
    return {
      name: period.slice(5),
      expected: rows.reduce((a, p) => a + p.amount, 0),
      received: rows.reduce((a, p) => a + Math.min(p.paidAmount, p.amount), 0),
    };
  });

  const upcoming = [...payments]
    .filter((p) => paymentState(p) !== "paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);
  const [mailNote, setMailNote] = useState("");

  useEffect(() => {
    void notifyRenewals().catch(() => undefined);
  }, []);

  return (
    <Shell>
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-card bg-ink p-5 text-paper md:p-7">
          <p className="text-sm text-paper/70">{t(lang, "thisMonth")}</p>
          <p className="font-display mt-2 text-4xl md:text-5xl">
            <Money>{hkd(expected, lang)}</Money>
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink-soft">
            <div
              className="h-full rounded-full bg-brass"
              style={{ width: expected ? `${Math.min(100, (collected / expected) * 100)}%` : "0%" }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-paper/60">{t(lang, "collected")}</p>
              <p className="mt-1 text-lg">
                <Money>{hkd(collected, lang)}</Money>
              </p>
            </div>
            <div>
              <p className="text-paper/60">{t(lang, "outstanding")}</p>
              <p className="mt-1 text-lg">
                <Money>{hkd(Math.max(expected - collected, 0), lang)}</Money>
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t(lang, "occupied")} value={`${occupiedIds.size}/${properties.length}`} hint={t(lang, "units")} />
          <Stat label={t(lang, "overdue")} value={String(overdue.length)} tone={overdue.length ? "clay" : "ink"} />
          <Stat label={t(lang, "expiring")} value={String(expiring.length)} />
          <Stat label={t(lang, "openRepairs")} value={String(open.length)} />
        </div>
      </section>

      <section className="mt-6 rounded-card border border-line bg-card p-4 md:p-5">
        <h2 className="font-display text-2xl text-ink">{t(lang, "collection")}</h2>
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} barGap={4}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(value) => hkd(Number(value), lang)}
                cursor={{ fill: "var(--color-paper)" }}
              />
              <Bar dataKey="expected" fill="var(--color-line)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="received" fill="var(--color-brass)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-muted">
          <span>{t(lang, "expected")}</span>
          <span className="text-brass">{t(lang, "received")}</span>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl text-ink">{t(lang, "renewTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t(lang, "renewHint")}</p>
        <button
          type="button"
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brass"
          onClick={() => {
            setMailNote("");
            void sendRenewalTest()
              .then((result) => setMailNote(result.ok ? t(lang, "renewTestSent") : t(lang, "renewTestFail")))
              .catch(() => setMailNote(t(lang, "renewTestFail")));
          }}
        >
          {t(lang, "renewTest")}
        </button>
        {mailNote ? <p className="text-sm text-muted">{mailNote}</p> : null}
        <ul className="mt-3 flex flex-col gap-2">
          {renewals.map((lease) => {
            const property = properties.find((x) => x.id === lease.propertyId);
            const tenant = tenants.find((x) => x.id === lease.tenantId);
            const days = daysUntil(lease.end);
            return (
              <li key={lease.id} className="rounded-2xl border border-line bg-card px-4 py-3">
                <p className="font-medium">{property?.name}</p>
                <p className="text-sm text-muted">
                  {tenant?.name} · {lease.end}
                  {days >= 0 ? ` · ${days}${lang === "zh" ? " 日" : " days"}` : ""}
                </p>
                <p className={`mt-1 text-sm ${days < 0 ? "text-clay" : "text-ink"}`}>
                  {days < 0 ? t(lang, "renewLate") : t(lang, "renewNow")}
                </p>
              </li>
            );
          })}
        </ul>
        {renewals.length === 0 && <p className="mt-3 text-sm text-muted">{t(lang, "renewNone")}</p>}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink">{t(lang, "upcoming")}</h2>
            <Link to="/ledger" className="text-sm text-brass">
              {t(lang, "viewAll")}
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {upcoming.map((p) => {
              const tenancy = tenancies.find((x) => x.id === p.tenancyId);
              const property = properties.find((x) => x.id === tenancy?.propertyId);
              const tenant = tenants.find((x) => x.id === tenancy?.tenantId);
              const state = paymentState(p);
              const district = DISTRICTS.find((d) => d.id === property?.district);
              return (
                <li key={p.id} className="rounded-2xl border border-line bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{property?.name}</p>
                      <p className="truncate text-sm text-muted">
                        {tenant?.name} · {lang === "zh" ? district?.zh : property?.district}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        <Money>{hkd(p.amount, lang)}</Money>
                      </p>
                      <Pill tone={state === "overdue" ? "clay" : "brass"}>
                        {state === "overdue" ? t(lang, "statusOverdue") : p.dueDate.slice(5)}
                      </Pill>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink">{t(lang, "repairs")}</h2>
            <Link to="/repairs" className="text-sm text-brass">
              {t(lang, "viewAll")}
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {open.slice(0, 4).map((k) => {
              const property = properties.find((p) => p.id === k.propertyId);
              return (
                <li key={k.id} className="rounded-2xl border border-line bg-card px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{k.title}</p>
                      <p className="text-sm text-muted">{property?.name}</p>
                    </div>
                    <Pill tone={k.priority === "high" ? "clay" : k.status === "doing" ? "brass" : "ink"}>
                      {k.priority === "high" ? t(lang, "priorityHigh") : t(lang, k.status === "doing" ? "statusDoing" : "statusOpen")}
                    </Pill>
                  </div>
                </li>
              );
            })}
            {open.length === 0 && <li className="text-sm text-muted">{t(lang, "emptyFix")}</li>}
          </ul>
        </div>
      </section>
    </Shell>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ink" | "clay";
}) {
  return (
    <div className="rounded-card border border-line bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`font-display mt-2 text-3xl tabular-nums ${tone === "clay" ? "text-clay" : "text-ink"}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

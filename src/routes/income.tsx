import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/rental/shell";
import { Money } from "@/components/rental/ui";
import { hkd } from "@/lib/rental/format";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";

export const Route = createFileRoute("/income")({ component: IncomePage });

function IncomePage() {
  const lang = useRental((s) => s.lang);
  const properties = useRental((s) => s.properties);
  const tenancies = useRental((s) => s.tenancies);
  const payments = useRental((s) => s.payments);
  const tickets = useRental((s) => s.tickets);

  const rows = new Map<string, { year: string; propertyId: string; rent: number; repairs: number }>();
  const touch = (year: string, propertyId: string) => {
    const key = `${year}|${propertyId}`;
    const row = rows.get(key) ?? { year, propertyId, rent: 0, repairs: 0 };
    rows.set(key, row);
    return row;
  };
  for (const payment of payments) {
    const year = payment.period.slice(0, 4);
    const lease = tenancies.find((item) => item.id === payment.tenancyId);
    if (!lease || !/^\d{4}$/.test(year) || payment.paidAmount <= 0) continue;
    touch(year, lease.propertyId).rent += payment.paidAmount;
  }
  for (const ticket of tickets) {
    const year = ticket.created.slice(0, 4);
    if (!/^\d{4}$/.test(year) || !ticket.cost) continue;
    touch(year, ticket.propertyId).repairs += ticket.cost;
  }

  const lines = [...rows.values()]
    .map((row) => {
      const property = properties.find((item) => item.id === row.propertyId);
      const management = (property?.managementFee ?? 0) * 12;
      const rates = (property?.rates ?? 0) * 4;
      return {
        ...row,
        name: property?.name ?? "—",
        management,
        rates,
        net: row.rent - row.repairs - management - rates,
      };
    })
    .sort((a, b) => b.year.localeCompare(a.year) || a.name.localeCompare(b.name, "zh-HK"));

  const years = [...new Set(lines.map((line) => line.year))];

  return (
    <Shell>
      <h1 className="font-display text-4xl text-ink">{t(lang, "incomeTitle")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t(lang, "incomeHint")}</p>
      {years.length === 0 ? <p className="mt-8 text-sm text-muted">{t(lang, "incomeEmpty")}</p> : null}
      {years.map((year) => {
        const group = lines.filter((line) => line.year === year);
        const total = group.reduce((sum, line) => sum + line.net, 0);
        return (
          <section key={year} className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-3xl text-ink">{year}</h2>
              <p className={`text-sm font-semibold ${total < 0 ? "text-clay" : "text-ink"}`}>
                {t(lang, "incomeYearTotal")} <Money>{hkd(total, lang)}</Money>
              </p>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {group.map((line) => (
                <li key={`${line.year}-${line.propertyId}`} className="rounded-2xl border border-line bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{line.name}</p>
                    <p className={`font-display text-2xl ${line.net < 0 ? "text-clay" : "text-ink"}`}>
                      <Money>{hkd(line.net, lang)}</Money>
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <Meta label={t(lang, "incomeRent")} value={hkd(line.rent, lang)} />
                    <Meta label={t(lang, "incomeRepairs")} value={hkd(line.repairs, lang)} />
                    <Meta label={t(lang, "incomeMgmt")} value={hkd(line.management, lang)} />
                    <Meta label={t(lang, "incomeRates")} value={hkd(line.rates, lang)} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Shell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <p className="mt-1 font-medium tabular-nums">
        <Money>{value}</Money>
      </p>
    </div>
  );
}

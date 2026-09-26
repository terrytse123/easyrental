import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/rental/shell";
import {
  Field,
  GhostButton,
  Money,
  Pill,
  PrimaryButton,
  Select,
  Sheet,
  TextInput,
} from "@/components/rental/ui";
import { fmtDate, hkd, paymentState, rentNotice, whatsappHref } from "@/lib/rental/format";
import { PAY_METHODS } from "@/lib/rental/hk";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";
import type { PayMethod, Payment } from "@/lib/rental/types";

export const Route = createFileRoute("/ledger")({ component: LedgerPage });

function LedgerPage() {
  const lang = useRental((s) => s.lang);
  const payments = useRental((s) => s.payments);
  const tenancies = useRental((s) => s.tenancies);
  const properties = useRental((s) => s.properties);
  const tenants = useRental((s) => s.tenants);
  const markPaid = useRental((s) => s.markPaid);
  const [filter, setFilter] = useState<"all" | "overdue" | "paid" | "due">("all");
  const [paying, setPaying] = useState<Payment | null>(null);

  const rows = [...payments]
    .filter((p) => {
      const state = paymentState(p);
      if (filter === "all") return true;
      if (filter === "due") return state === "due" || state === "partial";
      return state === filter;
    })
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  return (
    <Shell>
      <h1 className="font-display text-4xl text-ink">{t(lang, "navLedger")}</h1>
      <p className="mt-1 text-sm text-muted">{t(lang, "ledgerHint")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["all", t(lang, "all")],
            ["overdue", t(lang, "filterOverdue")],
            ["due", t(lang, "statusDue")],
            ["paid", t(lang, "filterPaid")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`min-h-11 rounded-full px-4 text-sm ${filter === id ? "bg-ink text-paper" : "border border-line bg-card"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="mt-5 flex flex-col gap-2">
        {rows.map((p) => {
          const lease = tenancies.find((x) => x.id === p.tenancyId);
          const property = properties.find((x) => x.id === lease?.propertyId);
          const tenant = tenants.find((x) => x.id === lease?.tenantId);
          const state = paymentState(p);
          const tone = state === "paid" ? "jade" : state === "overdue" ? "clay" : "brass";
          const label =
            state === "paid"
              ? t(lang, "statusPaid")
              : state === "overdue"
                ? t(lang, "statusOverdue")
                : state === "partial"
                  ? t(lang, "statusPartial")
                  : t(lang, "statusDue");
          const method = PAY_METHODS.find((m) => m.id === p.method);
          const notice = rentNotice({
            lang,
            tenant: tenant?.name || (lang === "zh" ? "租客" : "there"),
            property: property?.name || (lang === "zh" ? "單位" : "the flat"),
            period: p.period,
            amount: hkd(p.amount - p.paidAmount, lang),
            due: fmtDate(p.dueDate, lang),
          });
          const whatsapp = tenant?.phone ? whatsappHref(tenant.phone, notice) : null;
          return (
            <li key={p.id} className="rounded-2xl border border-line bg-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{property?.name}</p>
                  <p className="text-sm text-muted">
                    {tenant?.name} · {p.period} · {fmtDate(p.dueDate, lang)}
                  </p>
                  {p.paidDate && (
                    <p className="text-sm text-muted">
                      {method ? (lang === "zh" ? method.zh : method.en) : ""} {p.ref ? `· ${p.ref}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-display text-2xl">
                      <Money>{hkd(p.amount, lang)}</Money>
                    </p>
                    <Pill tone={tone}>{label}</Pill>
                  </div>
                  {state !== "paid" && (
                    <div className="flex flex-col items-end gap-1">
                      <PrimaryButton onClick={() => setPaying(p)}>{t(lang, "markPaid")}</PrimaryButton>
                      {whatsapp ? (
                        <a href={whatsapp} target="_blank" rel="noreferrer" className="min-h-11 text-sm font-semibold text-brass">
                          {t(lang, "whatsapp")}
                        </a>
                      ) : (
                        <span className="text-xs text-muted">{t(lang, "whatsappNeedPhone")}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="mt-8 text-sm text-muted">{t(lang, "emptyPay")}</p>}
      {paying && (
        <PaySheet
          onClose={() => setPaying(null)}
          onSave={(method, ref) => {
            markPaid(paying.id, method, ref);
            setPaying(null);
          }}
        />
      )}
    </Shell>
  );
}

function PaySheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (method: PayMethod, ref: string) => void;
}) {
  const lang = useRental((s) => s.lang);
  const [method, setMethod] = useState<PayMethod>("fps");
  const [ref, setRef] = useState("");
  return (
    <Sheet title={t(lang, "markPaid")} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(method, ref);
        }}
      >
        <Field label={t(lang, "method")}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
            {PAY_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {lang === "zh" ? m.zh : m.en}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t(lang, "ref")}>
          <TextInput value={ref} onChange={(e) => setRef(e.target.value)} placeholder="FPS-000000" />
        </Field>
        <div className="flex gap-2">
          <PrimaryButton type="submit">{t(lang, "save")}</PrimaryButton>
          <GhostButton type="button" onClick={onClose}>
            {t(lang, "cancel")}
          </GhostButton>
        </div>
      </form>
    </Sheet>
  );
}

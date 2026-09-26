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
import { fmtDate, hkd, monthKey, paymentState, todayISO } from "@/lib/rental/format";
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
  const addPayment = useRental((s) => s.addPayment);
  const [filter, setFilter] = useState<"all" | "overdue" | "paid" | "due">("all");
  const [propertyId, setPropertyId] = useState("all");
  const [paying, setPaying] = useState<Payment | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = [...payments]
    .filter((p) => {
      if (propertyId !== "all") {
        const lease = tenancies.find((x) => x.id === p.tenancyId);
        if (lease?.propertyId !== propertyId) return false;
      }
      const state = paymentState(p);
      if (filter === "all") return true;
      if (filter === "due") return state === "due" || state === "partial";
      return state === filter;
    })
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  return (
    <Shell>
      <h1 className="font-display text-4xl text-ink">{t(lang, "navLedger")}</h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t(lang, "ledgerHint")}</p>
        <PrimaryButton onClick={() => setAdding(true)} disabled={tenancies.length === 0}>
          {t(lang, "addPayment")}
        </PrimaryButton>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="all">{t(lang, "allProperties")}</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </Select>
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
                      {fmtDate(p.paidDate, lang)} · {method ? (lang === "zh" ? method.zh : method.en) : ""} {p.ref ? `· ${p.ref}` : ""}
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
                    <PrimaryButton onClick={() => setPaying(p)}>{t(lang, "markPaid")}</PrimaryButton>
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
          onSave={(method, ref, paidDate) => {
            markPaid(paying.id, method, ref, paidDate);
            setPaying(null);
          }}
        />
      )}
      {adding && (
        <AddPaySheet
          onClose={() => setAdding(false)}
          onSave={(value) => {
            addPayment(value);
            setAdding(false);
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
  onSave: (method: PayMethod, ref: string, paidDate: string) => void;
}) {
  const lang = useRental((s) => s.lang);
  const [method, setMethod] = useState<PayMethod>("fps");
  const [ref, setRef] = useState("");
  const [paidDate, setPaidDate] = useState(todayISO());
  return (
    <Sheet title={t(lang, "markPaid")} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(method, ref, paidDate);
        }}
      >
        <Field label={t(lang, "paidDate")}>
          <TextInput type="date" required value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
        </Field>
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

function AddPaySheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (value: {
    tenancyId: string;
    period: string;
    amount: number;
    paidDate: string;
    method: PayMethod;
    ref: string;
  }) => void;
}) {
  const lang = useRental((s) => s.lang);
  const tenancies = useRental((s) => s.tenancies);
  const properties = useRental((s) => s.properties);
  const tenants = useRental((s) => s.tenants);
  const [tenancyId, setTenancyId] = useState(tenancies[0]?.id ?? "");
  const lease = tenancies.find((item) => item.id === tenancyId);
  const [amount, setAmount] = useState(lease?.rent ?? 0);
  const [period, setPeriod] = useState(monthKey());
  const [paidDate, setPaidDate] = useState(todayISO());
  const [method, setMethod] = useState<PayMethod>("fps");
  const [ref, setRef] = useState("");
  return (
    <Sheet title={t(lang, "addPayment")} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!tenancyId || !period || !paidDate) return;
          onSave({ tenancyId, period, amount, paidDate, method, ref });
        }}
      >
        <Field label={t(lang, "navTenancies")}>
          <Select
            value={tenancyId}
            onChange={(e) => {
              const id = e.target.value;
              setTenancyId(id);
              const next = tenancies.find((item) => item.id === id);
              if (next) setAmount(next.rent);
            }}
          >
            {tenancies.map((item) => {
              const property = properties.find((row) => row.id === item.propertyId);
              const tenant = tenants.find((row) => row.id === item.tenantId);
              return (
                <option key={item.id} value={item.id}>
                  {property?.name ?? ""} · {tenant?.name ?? ""}
                </option>
              );
            })}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t(lang, "payMonth")}>
            <TextInput type="month" required value={period} onChange={(e) => setPeriod(e.target.value)} />
          </Field>
          <Field label={t(lang, "paidDate")}>
            <TextInput type="date" required value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </Field>
        </div>
        <Field label={t(lang, "rent")}>
          <TextInput type="number" min={0} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </Field>
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
          <TextInput value={ref} onChange={(e) => setRef(e.target.value)} />
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

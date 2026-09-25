import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/rental/shell";
import {
  DangerButton,
  Field,
  GhostButton,
  Money,
  Pill,
  PrimaryButton,
  Select,
  Sheet,
  TextInput,
} from "@/components/rental/ui";
import { daysUntil, fmtDate, hkd } from "@/lib/rental/format";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";

export const Route = createFileRoute("/tenancies")({ component: TenanciesPage });

function TenanciesPage() {
  const lang = useRental((s) => s.lang);
  const tenancies = useRental((s) => s.tenancies);
  const properties = useRental((s) => s.properties);
  const tenants = useRental((s) => s.tenants);
  const addTenancy = useRental((s) => s.addTenancy);
  const updateTenancy = useRental((s) => s.updateTenancy);
  const removeTenancy = useRental((s) => s.removeTenancy);
  const addTenant = useRental((s) => s.addTenant);
  const removeTenant = useRental((s) => s.removeTenant);
  const [leaseOpen, setLeaseOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl text-ink">{t(lang, "navTenancies")}</h1>
        <div className="flex gap-2">
          <GhostButton onClick={() => setTenantOpen(true)}>{t(lang, "addTenant")}</GhostButton>
          <PrimaryButton onClick={() => setLeaseOpen(true)} disabled={properties.length === 0 || tenants.length === 0}>
            {t(lang, "addTenancy")}
          </PrimaryButton>
        </div>
      </div>
      <ul className="mt-5 flex flex-col gap-3">
        {tenancies.map((lease) => {
          const property = properties.find((p) => p.id === lease.propertyId);
          const tenant = tenants.find((p) => p.id === lease.tenantId);
          const left = daysUntil(lease.end);
          return (
            <li key={lease.id} className="rounded-card border border-line bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-2xl text-ink">{property?.name ?? t(lang, "property")}</p>
                  <p className="mt-1 text-sm text-muted">{tenant?.name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone={lease.active ? "jade" : "ink"}>{lease.active ? t(lang, "active") : t(lang, "ended")}</Pill>
                  <Pill tone={lease.stamped ? "brass" : "clay"}>{lease.stamped ? t(lang, "stamped") : t(lang, "unstamped")}</Pill>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <Meta label={t(lang, "rent")} value={hkd(lease.rent, lang)} />
                <Meta label={t(lang, "deposit")} value={hkd(lease.deposit, lang)} />
                <Meta label={t(lang, "start")} value={fmtDate(lease.start, lang)} />
                <Meta
                  label={t(lang, "end")}
                  value={`${fmtDate(lease.end, lang)}${lease.active && left >= 0 ? ` · ${left}${t(lang, "days")}` : ""}`}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <GhostButton onClick={() => updateTenancy(lease.id, { stamped: !lease.stamped })}>
                  {lease.stamped ? t(lang, "unstamped") : t(lang, "stamped")}
                </GhostButton>
                <GhostButton onClick={() => updateTenancy(lease.id, { active: !lease.active })}>
                  {lease.active ? t(lang, "ended") : t(lang, "active")}
                </GhostButton>
                <DangerButton onClick={() => removeTenancy(lease.id)}>{t(lang, "delete")}</DangerButton>
              </div>
            </li>
          );
        })}
      </ul>

      <h2 className="font-display mt-10 text-2xl text-ink">{t(lang, "tenant")}</h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {tenants.map((person) => (
          <li key={person.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-lg font-medium">{person.name}</p>
            <p className="mt-1 text-sm text-muted">{person.phone}</p>
            <p className="text-sm text-muted">{person.email}</p>
            {person.notes && <p className="mt-2 text-sm">{person.notes}</p>}
            <div className="mt-3">
              <DangerButton onClick={() => removeTenant(person.id)}>{t(lang, "delete")}</DangerButton>
            </div>
          </li>
        ))}
      </ul>

      {leaseOpen && (
        <LeaseForm
          onClose={() => setLeaseOpen(false)}
          onSave={(value) => {
            addTenancy(value);
            setLeaseOpen(false);
          }}
        />
      )}
      {tenantOpen && (
        <TenantForm
          onClose={() => setTenantOpen(false)}
          onSave={(value) => {
            addTenant(value);
            setTenantOpen(false);
          }}
        />
      )}
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

function LeaseForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (value: {
    propertyId: string;
    tenantId: string;
    start: string;
    end: string;
    rent: number;
    deposit: number;
    dueDay: number;
    stamped: boolean;
    active: boolean;
  }) => void;
}) {
  const lang = useRental((s) => s.lang);
  const properties = useRental((s) => s.properties);
  const tenants = useRental((s) => s.tenants);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [start, setStart] = useState("2026-10-01");
  const [end, setEnd] = useState("2028-09-30");
  const [rent, setRent] = useState(properties[0]?.rent ?? 15000);
  const [dueDay, setDueDay] = useState(1);
  const [stamped, setStamped] = useState(false);

  return (
    <Sheet title={t(lang, "addTenancy")} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            propertyId,
            tenantId,
            start,
            end,
            rent,
            deposit: rent * 2,
            dueDay,
            stamped,
            active: true,
          });
        }}
      >
        <Field label={t(lang, "property")}>
          <Select
            value={propertyId}
            onChange={(e) => {
              const id = e.target.value;
              setPropertyId(id);
              const found = properties.find((p) => p.id === id);
              if (found) setRent(found.rent);
            }}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t(lang, "tenant")}>
          <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
            {tenants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t(lang, "start")}>
            <TextInput type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label={t(lang, "end")}>
            <TextInput type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t(lang, "rent")}>
            <TextInput type="number" min={0} value={rent} onChange={(e) => setRent(Number(e.target.value))} />
          </Field>
          <Field label={t(lang, "dueDay")}>
            <TextInput
              type="number"
              min={1}
              max={28}
              value={dueDay}
              onChange={(e) => setDueDay(Number(e.target.value))}
            />
          </Field>
        </div>
        <p className="text-sm text-muted">
          {t(lang, "deposit")}: {hkd(rent * 2, lang)}
        </p>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={stamped} onChange={(e) => setStamped(e.target.checked)} />
          {t(lang, "stamped")}
        </label>
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

function TenantForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (value: { name: string; phone: string; email: string; notes: string }) => void;
}) {
  const lang = useRental((s) => s.lang);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Sheet title={t(lang, "addTenant")} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave({ name: name.trim(), phone: phone.trim(), email: email.trim(), notes: notes.trim() });
        }}
      >
        <Field label={t(lang, "name")}>
          <TextInput required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t(lang, "phone")}>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </Field>
        <Field label={t(lang, "email")}>
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t(lang, "notes")}>
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
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

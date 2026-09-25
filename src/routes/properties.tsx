import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  TextArea,
  TextInput,
} from "@/components/rental/ui";
import { DISTRICTS, PROPERTY_TYPES } from "@/lib/rental/hk";
import { hkd } from "@/lib/rental/format";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";
import type { Property, PropertyType } from "@/lib/rental/types";

export const Route = createFileRoute("/properties")({ component: PropertiesPage });

const blank = {
  name: "",
  address: "",
  district: "Eastern",
  type: "private" as PropertyType,
  beds: 1,
  baths: 1,
  sqft: 400,
  rent: 15000,
  managementFee: 0,
  rates: 0,
  notes: "",
};

function PropertiesPage() {
  const lang = useRental((s) => s.lang);
  const properties = useRental((s) => s.properties);
  const tenancies = useRental((s) => s.tenancies);
  const tenants = useRental((s) => s.tenants);
  const addProperty = useRental((s) => s.addProperty);
  const updateProperty = useRental((s) => s.updateProperty);
  const removeProperty = useRental((s) => s.removeProperty);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "let" | "vacant">("all");
  const [editing, setEditing] = useState<Property | "new" | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return properties.filter((p) => {
      const letOut = tenancies.some((x) => x.active && x.propertyId === p.id);
      if (filter === "let" && !letOut) return false;
      if (filter === "vacant" && letOut) return false;
      const district = DISTRICTS.find((d) => d.id === p.district);
      const blob = `${p.name} ${p.address} ${p.district} ${district?.zh ?? ""}`.toLowerCase();
      return blob.includes(q.trim().toLowerCase());
    });
  }, [properties, tenancies, filter, q]);

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-ink">{t(lang, "navProperties")}</h1>
          <p className="mt-1 text-sm text-muted">
            {properties.length} {t(lang, "units")}
          </p>
        </div>
        <PrimaryButton onClick={() => setEditing("new")}>{t(lang, "addProperty")}</PrimaryButton>
      </div>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang, "search")} />
        <div className="flex gap-2">
          {(
            [
              ["all", t(lang, "all")],
              ["let", t(lang, "occupied")],
              ["vacant", t(lang, "vacant")],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`min-h-11 rounded-full px-4 text-sm ${filter === id ? "bg-ink text-paper" : "border border-line bg-card text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-5 grid gap-3 lg:grid-cols-2">
        {rows.map((p) => {
          const tenancy = tenancies.find((x) => x.active && x.propertyId === p.id);
          const tenant = tenants.find((x) => x.id === tenancy?.tenantId);
          const district = DISTRICTS.find((d) => d.id === p.district);
          const kind = PROPERTY_TYPES.find((x) => x.id === p.type);
          return (
            <li key={p.id} className="rounded-card border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-2xl text-ink">{p.name}</p>
                  <p className="mt-1 text-sm text-muted">{p.address}</p>
                </div>
                <Pill tone={tenancy ? "jade" : "brass"}>{tenancy ? t(lang, "occupied") : t(lang, "vacant")}</Pill>
              </div>
              <p className="mt-3 text-sm text-muted">
                {lang === "zh" ? district?.zh : p.district} · {lang === "zh" ? kind?.zh : kind?.en} · {p.beds}
                {t(lang, "beds")} {p.baths}
                {t(lang, "baths")} · {p.sqft} {lang === "zh" ? "平方呎" : "sq ft"}
              </p>
              <p className="mt-3 font-display text-3xl text-ink">
                <Money>{hkd(p.rent, lang)}</Money>
                <span className="ml-1 font-sans text-sm text-muted">{t(lang, "perMonth")}</span>
              </p>
              {tenant && <p className="mt-1 text-sm">{tenant.name}</p>}
              <div className="mt-4 flex gap-2">
                <GhostButton onClick={() => setEditing(p)}>{t(lang, "edit")}</GhostButton>
                <DangerButton onClick={() => setConfirmId(p.id)}>{t(lang, "delete")}</DangerButton>
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="mt-8 text-sm text-muted">{q ? t(lang, "noMatch") : t(lang, "emptyProps")}</p>}
      {editing && (
        <PropertyForm
          initial={editing === "new" ? blank : editing}
          title={editing === "new" ? t(lang, "addProperty") : t(lang, "edit")}
          onClose={() => setEditing(null)}
          onSave={(value) => {
            if (editing === "new") addProperty(value);
            else updateProperty(editing.id, value);
            setEditing(null);
          }}
        />
      )}
      {confirmId && (
        <Sheet title={t(lang, "delete")} onClose={() => setConfirmId(null)}>
          <p className="text-sm text-muted">{t(lang, "confirmDelete")}</p>
          <div className="mt-5 flex gap-2">
            <DangerButton
              onClick={() => {
                removeProperty(confirmId);
                setConfirmId(null);
              }}
            >
              {t(lang, "yesDelete")}
            </DangerButton>
            <GhostButton onClick={() => setConfirmId(null)}>{t(lang, "cancel")}</GhostButton>
          </div>
        </Sheet>
      )}
    </Shell>
  );
}

function PropertyForm({
  initial,
  title,
  onClose,
  onSave,
}: {
  initial: Omit<Property, "id">;
  title: string;
  onClose: () => void;
  onSave: (value: Omit<Property, "id">) => void;
}) {
  const lang = useRental((s) => s.lang);
  const [form, setForm] = useState(initial);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Sheet title={title} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim() || !form.address.trim()) return;
          onSave({ ...form, name: form.name.trim(), address: form.address.trim() });
        }}
      >
        <Field label={t(lang, "name")}>
          <TextInput required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label={t(lang, "address")}>
          <TextInput required value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t(lang, "district")}>
            <Select value={form.district} onChange={(e) => set("district", e.target.value)}>
              {DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {lang === "zh" ? d.zh : d.id}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t(lang, "type")}>
            <Select value={form.type} onChange={(e) => set("type", e.target.value as PropertyType)}>
              {PROPERTY_TYPES.map((d) => (
                <option key={d.id} value={d.id}>
                  {lang === "zh" ? d.zh : d.en}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t(lang, "beds")}>
            <TextInput type="number" min={0} value={form.beds} onChange={(e) => set("beds", Number(e.target.value))} />
          </Field>
          <Field label={t(lang, "baths")}>
            <TextInput type="number" min={0} value={form.baths} onChange={(e) => set("baths", Number(e.target.value))} />
          </Field>
          <Field label={t(lang, "sqft")}>
            <TextInput type="number" min={0} value={form.sqft} onChange={(e) => set("sqft", Number(e.target.value))} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t(lang, "rent")}>
            <TextInput type="number" min={0} value={form.rent} onChange={(e) => set("rent", Number(e.target.value))} />
          </Field>
          <Field label={t(lang, "mgmt")}>
            <TextInput
              type="number"
              min={0}
              value={form.managementFee}
              onChange={(e) => set("managementFee", Number(e.target.value))}
            />
          </Field>
          <Field label={t(lang, "rates")}>
            <TextInput type="number" min={0} value={form.rates} onChange={(e) => set("rates", Number(e.target.value))} />
          </Field>
        </div>
        <Field label={t(lang, "notes")}>
          <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <div className="mt-2 flex gap-2">
          <PrimaryButton type="submit">{t(lang, "save")}</PrimaryButton>
          <GhostButton type="button" onClick={onClose}>
            {t(lang, "cancel")}
          </GhostButton>
        </div>
      </form>
    </Sheet>
  );
}

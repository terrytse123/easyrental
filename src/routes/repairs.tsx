import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/rental/shell";
import {
  DangerButton,
  Field,
  GhostButton,
  Pill,
  PrimaryButton,
  Select,
  Sheet,
  TextArea,
  TextInput,
} from "@/components/rental/ui";
import { fmtDate, hkd } from "@/lib/rental/format";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";
import type { Priority, TicketStatus } from "@/lib/rental/types";

export const Route = createFileRoute("/repairs")({ component: RepairsPage });

const nextStatus: Record<TicketStatus, TicketStatus> = {
  open: "doing",
  doing: "done",
  done: "open",
};

function RepairsPage() {
  const lang = useRental((s) => s.lang);
  const tickets = useRental((s) => s.tickets);
  const properties = useRental((s) => s.properties);
  const addTicket = useRental((s) => s.addTicket);
  const setTicketStatus = useRental((s) => s.setTicketStatus);
  const removeTicket = useRental((s) => s.removeTicket);
  const [open, setOpen] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);

  const rows = tickets.filter((k) => (onlyOpen ? k.status !== "done" : true));

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl text-ink">{t(lang, "navRepairs")}</h1>
        <PrimaryButton onClick={() => setOpen(true)} disabled={properties.length === 0}>
          {t(lang, "addRepair")}
        </PrimaryButton>
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOnlyOpen((v) => !v)}
          className={`min-h-11 rounded-full px-4 text-sm ${onlyOpen ? "bg-ink text-paper" : "border border-line bg-card"}`}
        >
          {t(lang, "filterOpen")}
        </button>
      </div>
      <ul className="mt-5 flex flex-col gap-3">
        {rows.map((k) => {
          const property = properties.find((p) => p.id === k.propertyId);
          const statusKey = k.status === "open" ? "statusOpen" : k.status === "doing" ? "statusDoing" : "statusDone";
          const priKey = k.priority === "high" ? "priorityHigh" : k.priority === "med" ? "priorityMed" : "priorityLow";
          return (
            <li key={k.id} className="rounded-card border border-line bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-2xl text-ink">{k.title}</p>
                  <p className="mt-1 text-sm text-muted">
                    {property?.name} · {fmtDate(k.created, lang)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Pill tone={k.priority === "high" ? "clay" : "brass"}>{t(lang, priKey)}</Pill>
                  <Pill tone={k.status === "done" ? "jade" : "ink"}>{t(lang, statusKey)}</Pill>
                </div>
              </div>
              <p className="mt-3 text-sm">{k.detail}</p>
              {typeof k.cost === "number" && k.cost > 0 && (
                <p className="mt-2 text-sm text-muted">
                  {t(lang, "cost")}: {hkd(k.cost, lang)}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <GhostButton onClick={() => setTicketStatus(k.id, nextStatus[k.status])}>
                  {t(lang, k.status === "done" ? "statusOpen" : k.status === "open" ? "statusDoing" : "statusDone")}
                </GhostButton>
                <DangerButton onClick={() => removeTicket(k.id)}>{t(lang, "delete")}</DangerButton>
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="mt-8 text-sm text-muted">{t(lang, "emptyFix")}</p>}
      {open && (
        <RepairForm
          onClose={() => setOpen(false)}
          onSave={(value) => {
            addTicket(value);
            setOpen(false);
          }}
        />
      )}
    </Shell>
  );
}

function RepairForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (value: {
    propertyId: string;
    title: string;
    detail: string;
    status: TicketStatus;
    priority: Priority;
    cost?: number;
  }) => void;
}) {
  const lang = useRental((s) => s.lang);
  const properties = useRental((s) => s.properties);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [priority, setPriority] = useState<Priority>("med");
  const [cost, setCost] = useState("");

  return (
    <Sheet title={t(lang, "addRepair")} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          const parsed = Number(cost);
          onSave({
            propertyId,
            title: title.trim(),
            detail: detail.trim(),
            status: "open",
            priority,
            cost: cost.trim() && Number.isFinite(parsed) ? parsed : undefined,
          });
        }}
      >
        <Field label={t(lang, "property")}>
          <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t(lang, "title")}>
          <TextInput required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={t(lang, "detail")}>
          <TextArea value={detail} onChange={(e) => setDetail(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t(lang, "priorityMed")}>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="high">{t(lang, "priorityHigh")}</option>
              <option value="med">{t(lang, "priorityMed")}</option>
              <option value="low">{t(lang, "priorityLow")}</option>
            </Select>
          </Field>
          <Field label={t(lang, "cost")}>
            <TextInput inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        </div>
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

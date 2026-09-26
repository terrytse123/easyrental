import type { Payment, Property, RentalData, Tenancy, Tenant, Ticket } from "./types";

function asList<T>(value: unknown): T[] | null {
  return Array.isArray(value) ? (value as T[]) : null;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asOptionalDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

/** Normalize one tenancy; legacy rows without paid fields load as unpaid. */
export function asTenancy(raw: unknown): Tenancy {
  if (!raw || typeof raw !== "object") throw new Error("Invalid tenancy");
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const propertyId = typeof row.propertyId === "string" ? row.propertyId : "";
  const tenantId = typeof row.tenantId === "string" ? row.tenantId : "";
  const start = typeof row.start === "string" ? row.start : "";
  const end = typeof row.end === "string" ? row.end : "";
  if (!id || !propertyId || !tenantId || !start || !end) throw new Error("Invalid tenancy");
  const deposit = Math.max(0, asFiniteNumber(row.deposit, 0));
  const depositPaidAmount = Math.max(0, asFiniteNumber(row.depositPaidAmount, 0));
  const depositPaidOn = asOptionalDate(row.depositPaidOn);
  return {
    id,
    propertyId,
    tenantId,
    start,
    end,
    rent: Math.max(0, asFiniteNumber(row.rent, 0)),
    deposit,
    depositPaidAmount,
    ...(depositPaidOn ? { depositPaidOn } : {}),
    dueDay: Math.min(28, Math.max(1, Math.round(asFiniteNumber(row.dueDay, 1)))),
    stamped: Boolean(row.stamped),
    active: row.active !== false,
  };
}

export function asLedger(data: unknown): RentalData {
  if (!data || typeof data !== "object") throw new Error("Invalid ledger");
  const row = data as Record<string, unknown>;
  const properties = asList<Property>(row.properties);
  const tenants = asList<Tenant>(row.tenants);
  const tenancyRaw = asList<unknown>(row.tenancies);
  const payments = asList<Payment>(row.payments);
  const tickets = asList<Ticket>(row.tickets);
  if (!properties || !tenants || !tenancyRaw || !payments || !tickets) {
    throw new Error("Invalid ledger");
  }
  const tenancies = tenancyRaw.map(asTenancy);
  const ledger = { properties, tenants, tenancies, payments, tickets };
  if (JSON.stringify(ledger).length > 400_000) throw new Error("Ledger is too large");
  return ledger;
}

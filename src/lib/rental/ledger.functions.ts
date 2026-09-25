import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { Payment, Property, RentalData, Tenancy, Tenant, Ticket } from "./types";

const EMPTY: RentalData = {
  properties: [],
  tenants: [],
  tenancies: [],
  payments: [],
  tickets: [],
};

function asList<T>(value: unknown): T[] | null {
  return Array.isArray(value) ? (value as T[]) : null;
}

export function asLedger(data: unknown): RentalData {
  if (!data || typeof data !== "object") throw new Error("Invalid ledger");
  const row = data as Record<string, unknown>;
  const properties = asList<Property>(row.properties);
  const tenants = asList<Tenant>(row.tenants);
  const tenancies = asList<Tenancy>(row.tenancies);
  const payments = asList<Payment>(row.payments);
  const tickets = asList<Ticket>(row.tickets);
  if (!properties || !tenants || !tenancies || !payments || !tickets) {
    throw new Error("Invalid ledger");
  }
  const ledger = { properties, tenants, tenancies, payments, tickets };
  if (JSON.stringify(ledger).length > 400_000) throw new Error("Ledger is too large");
  return ledger;
}

function readPayload(payload: unknown): RentalData {
  const raw = typeof payload === "string" ? JSON.parse(payload) : payload;
  return asLedger(raw);
}

export const getLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ payload: unknown }>`
      select payload from ledgers where user_id = ${context.userId}
    `;
    if (!rows[0]) return EMPTY;
    return readPayload(rows[0].payload);
  });

export const saveLedger = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: RentalData) => asLedger(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into ledgers (user_id, payload, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (user_id) do update
         set payload = excluded.payload, updated_at = now()`,
      [context.userId, JSON.stringify(data)],
    );
    return { ok: true as const };
  });

import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  asUpdatedAtIso,
  isStaleSave,
  ledgerSaveConflict,
  ledgerSaveOk,
  type LedgerSaveResult,
} from "./ledger-conflict";
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

export type LedgerLoadResult = {
  data: RentalData;
  /** Null when the user has never saved a ledger row. */
  updatedAt: string | null;
};

function parseExpectedUpdatedAt(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("Invalid expectedUpdatedAt");
  return asUpdatedAtIso(value);
}

export const getLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<LedgerLoadResult> => {
    const sql = await getSql();
    const rows = await sql<{ payload: unknown; updated_at: unknown }>`
      select payload, updated_at from ledgers where user_id = ${context.userId}
    `;
    if (!rows[0]) return { data: EMPTY, updatedAt: null };
    return {
      data: readPayload(rows[0].payload),
      updatedAt: asUpdatedAtIso(rows[0].updated_at),
    };
  });

export const saveLedger = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ledger: RentalData; expectedUpdatedAt: string | null }) => {
    if (!input || typeof input !== "object") throw new Error("Invalid save");
    return {
      ledger: asLedger(input.ledger),
      expectedUpdatedAt: parseExpectedUpdatedAt(input.expectedUpdatedAt),
    };
  })
  .handler(async ({ context, data }): Promise<LedgerSaveResult> => {
    const sql = await getSql();
    const payloadJson = JSON.stringify(data.ledger);

    // Atomic optimistic upsert: INSERT when missing; UPDATE only when the
    // client's expectedUpdatedAt matches the current row. Otherwise RETURNING
    // is empty and we report conflict without overwriting.
    // Truncate to milliseconds so the token round-trips through JS Date
    // (Postgres timestamptz is microsecond-precise; Date is not).
    const returning = await sql.query<{ updated_at: unknown }>(
      `insert into ledgers (user_id, payload, updated_at)
       values ($1, $2::jsonb, date_trunc('milliseconds', now()))
       on conflict (user_id) do update
         set payload = excluded.payload,
             updated_at = date_trunc('milliseconds', now())
       where date_trunc('milliseconds', ledgers.updated_at)
             is not distinct from date_trunc('milliseconds', $3::timestamptz)
       returning updated_at`,
      [context.userId, payloadJson, data.expectedUpdatedAt],
    );

    if (!isStaleSave(returning)) {
      return ledgerSaveOk(returning[0].updated_at);
    }

    const current = await sql<{ updated_at: unknown }>`
      select updated_at from ledgers where user_id = ${context.userId}
    `;
    if (!current[0]) {
      // Extremely rare race (row vanished between attempts); treat as retryable error.
      throw new Error("Ledger row missing after conflict");
    }
    return ledgerSaveConflict(current[0].updated_at);
  });

/** Optimistic concurrency helpers for ledger saves (updated_at token). */

export type LedgerSaveOk = { ok: true; updatedAt: string };
export type LedgerSaveConflict = {
  ok: false;
  conflict: true;
  serverUpdatedAt: string;
};
export type LedgerSaveResult = LedgerSaveOk | LedgerSaveConflict;

/** Normalize DB / client timestamps to comparable ISO-8601 UTC strings. */
export function asUpdatedAtIso(value: unknown): string {
  if (value instanceof Date) {
    const ms = value.getTime();
    if (Number.isNaN(ms)) throw new Error("Invalid updated_at");
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error("Invalid updated_at");
    return d.toISOString();
  }
  throw new Error("Invalid updated_at");
}

/**
 * Whether a save may proceed given the client's expected token and the row
 * currently in the DB. No row → insert OK. Otherwise expected must match.
 * Mirrors the SQL `ON CONFLICT … WHERE updated_at IS NOT DISTINCT FROM $expected`.
 */
export function canOverwriteLedger(args: {
  expectedUpdatedAt: string | null;
  rowUpdatedAt: string | null;
}): boolean {
  if (args.rowUpdatedAt === null) return true;
  if (args.expectedUpdatedAt === null) return false;
  return asUpdatedAtIso(args.expectedUpdatedAt) === asUpdatedAtIso(args.rowUpdatedAt);
}

/** Conditional upsert returned no row → another device wrote first. */
export function isStaleSave(returningRows: readonly unknown[]): boolean {
  return returningRows.length === 0;
}

export function ledgerSaveOk(updatedAt: unknown): LedgerSaveOk {
  return { ok: true, updatedAt: asUpdatedAtIso(updatedAt) };
}

export function ledgerSaveConflict(serverUpdatedAt: unknown): LedgerSaveConflict {
  return {
    ok: false,
    conflict: true,
    serverUpdatedAt: asUpdatedAtIso(serverUpdatedAt),
  };
}

export function isLedgerConflict(result: LedgerSaveResult): result is LedgerSaveConflict {
  return result.ok === false && result.conflict === true;
}

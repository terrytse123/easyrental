import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  asUpdatedAtIso,
  canOverwriteLedger,
  isLedgerConflict,
  isStaleSave,
  ledgerSaveConflict,
  ledgerSaveOk,
} from "./ledger-conflict.ts";

const T1 = "2026-09-26T10:00:00.000Z";
const T2 = "2026-09-26T11:00:00.000Z";

describe("canOverwriteLedger", () => {
  it("allows first save when no row exists (expected null)", () => {
    assert.equal(canOverwriteLedger({ expectedUpdatedAt: null, rowUpdatedAt: null }), true);
  });

  it("allows first save when no row exists even if client sent a token", () => {
    assert.equal(canOverwriteLedger({ expectedUpdatedAt: T1, rowUpdatedAt: null }), true);
  });

  it("rejects when client thinks empty but server has a row", () => {
    assert.equal(canOverwriteLedger({ expectedUpdatedAt: null, rowUpdatedAt: T1 }), false);
  });

  it("allows update when expected matches row", () => {
    assert.equal(canOverwriteLedger({ expectedUpdatedAt: T1, rowUpdatedAt: T1 }), true);
  });

  it("rejects when expected is stale vs row", () => {
    assert.equal(canOverwriteLedger({ expectedUpdatedAt: T1, rowUpdatedAt: T2 }), false);
  });

  it("treats equivalent ISO forms as a match", () => {
    assert.equal(
      canOverwriteLedger({
        expectedUpdatedAt: "2026-09-26T10:00:00.000Z",
        rowUpdatedAt: "2026-09-26T10:00:00+00:00",
      }),
      true,
    );
  });
});

describe("asUpdatedAtIso", () => {
  it("normalizes Date and string to the same ISO", () => {
    assert.equal(asUpdatedAtIso(new Date(T1)), T1);
    assert.equal(asUpdatedAtIso(T1), T1);
  });

  it("rejects empty or invalid values", () => {
    assert.throws(() => asUpdatedAtIso(null));
    assert.throws(() => asUpdatedAtIso(""));
    assert.throws(() => asUpdatedAtIso("not-a-date"));
  });
});

describe("isStaleSave / save result builders", () => {
  it("detects empty RETURNING as stale", () => {
    assert.equal(isStaleSave([]), true);
    assert.equal(isStaleSave([{ updated_at: T2 }]), false);
  });

  it("builds ok and conflict results", () => {
    const ok = ledgerSaveOk(T2);
    assert.deepEqual(ok, { ok: true, updatedAt: T2 });
    assert.equal(isLedgerConflict(ok), false);

    const conflict = ledgerSaveConflict(T2);
    assert.deepEqual(conflict, { ok: false, conflict: true, serverUpdatedAt: T2 });
    assert.equal(isLedgerConflict(conflict), true);
  });
});

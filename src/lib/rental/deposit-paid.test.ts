import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { asLedger, asTenancy } from "./ledger-parse.ts";
import { depositState } from "./format.ts";
import type { RentalData } from "./types.ts";

const baseLease = {
  id: "tn-legacy",
  propertyId: "p1",
  tenantId: "t1",
  start: "2025-01-01",
  end: "2026-12-31",
  rent: 10000,
  deposit: 20000,
  dueDay: 1,
  stamped: false,
  active: true,
};

function emptyLedger(tenancies: unknown[]): RentalData {
  return asLedger({
    properties: [],
    tenants: [],
    tenancies,
    payments: [],
    tickets: [],
  });
}

describe("asTenancy / asLedger deposit paid defaults", () => {
  it("migrates legacy tenancy without paid fields as unpaid / zero / no date", () => {
    const lease = asTenancy(baseLease);
    assert.equal(lease.deposit, 20000);
    assert.equal(lease.depositPaidAmount, 0);
    assert.equal(lease.depositPaidOn, undefined);
    assert.equal(depositState(lease), "unpaid");
  });

  it("does not invent paid=true when depositPaidAmount is missing or null", () => {
    const a = asTenancy({ ...baseLease, depositPaidAmount: null, depositPaidOn: null });
    const b = asTenancy({ ...baseLease, depositPaidAmount: undefined });
    assert.equal(a.depositPaidAmount, 0);
    assert.equal(a.depositPaidOn, undefined);
    assert.equal(b.depositPaidAmount, 0);
    assert.equal(depositState(a), "unpaid");
    assert.equal(depositState(b), "unpaid");
  });

  it("preserves existing paid amount and date", () => {
    const lease = asTenancy({
      ...baseLease,
      depositPaidAmount: 20000,
      depositPaidOn: "2025-01-05",
    });
    assert.equal(lease.depositPaidAmount, 20000);
    assert.equal(lease.depositPaidOn, "2025-01-05");
    assert.equal(depositState(lease), "paid");
  });

  it("treats partial receipt as partial", () => {
    const lease = asTenancy({
      ...baseLease,
      depositPaidAmount: 8000,
      depositPaidOn: "2025-01-05",
    });
    assert.equal(depositState(lease), "partial");
  });

  it("rejects invalid paid-on dates and keeps amount", () => {
    const lease = asTenancy({
      ...baseLease,
      depositPaidAmount: 5000,
      depositPaidOn: "not-a-date",
    });
    assert.equal(lease.depositPaidAmount, 5000);
    assert.equal(lease.depositPaidOn, undefined);
    assert.equal(depositState(lease), "partial");
  });

  it("asLedger maps a mixed list with legacy unpaid defaults", () => {
    const ledger = emptyLedger([
      baseLease,
      { ...baseLease, id: "tn-paid", depositPaidAmount: 20000, depositPaidOn: "2025-02-01" },
    ]);
    assert.equal(ledger.tenancies.length, 2);
    assert.equal(ledger.tenancies[0].depositPaidAmount, 0);
    assert.equal(ledger.tenancies[0].depositPaidOn, undefined);
    assert.equal(depositState(ledger.tenancies[0]), "unpaid");
    assert.equal(ledger.tenancies[1].depositPaidAmount, 20000);
    assert.equal(ledger.tenancies[1].depositPaidOn, "2025-02-01");
    assert.equal(depositState(ledger.tenancies[1]), "paid");
  });
});

describe("depositState", () => {
  it("returns unpaid when received is zero even if owed is zero", () => {
    assert.equal(depositState({ deposit: 0, depositPaidAmount: 0 }), "unpaid");
  });

  it("returns paid when received covers owed", () => {
    assert.equal(depositState({ deposit: 100, depositPaidAmount: 100 }), "paid");
    assert.equal(depositState({ deposit: 100, depositPaidAmount: 150 }), "paid");
  });
});

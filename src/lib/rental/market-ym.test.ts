import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { formatFetchedAt, formatYm } from "./format.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("LATEST_RENTS_YM", () => {
  it("is exported as YYYY-MM matching April 2026 rents", () => {
    const src = readFileSync(join(here, "market.ts"), "utf8");
    const match = src.match(/export const LATEST_RENTS_YM = "(\d{4}-\d{2})"/);
    assert.ok(match, "LATEST_RENTS_YM export missing");
    assert.equal(match[1], "2026-04");
    assert.match(match[1], /^\d{4}-\d{2}$/);
  });
});

describe("formatYm", () => {
  it("formats zh as 年/月 without leading zero on month", () => {
    assert.equal(formatYm("zh", "2026-04"), "2026年4月");
    assert.equal(formatYm("zh", "2025-12"), "2025年12月");
  });

  it("formats en as Month YYYY", () => {
    assert.equal(formatYm("en", "2026-04"), "April 2026");
    assert.equal(formatYm("en", "2025-12"), "December 2025");
  });

  it("returns the input when ym is invalid", () => {
    assert.equal(formatYm("zh", "not-a-month"), "not-a-month");
    assert.equal(formatYm("en", "2026-13"), "2026-13");
  });
});

describe("formatFetchedAt", () => {
  it("renders Hong Kong local YYYY-MM-DD HH:mm", () => {
    // 2026-09-26T13:16:00Z == 21:16 HKT (UTC+8)
    assert.equal(formatFetchedAt("2026-09-26T13:16:00.000Z"), "2026-09-26 21:16");
  });
});

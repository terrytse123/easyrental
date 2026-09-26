import { DISTRICTS } from "./hk";

/** Rating and Valuation Department, Hong Kong Property Review — Monthly Supplement, June 2026.
 *  Table 1.1 average rents ($/m²/month) and Table 1.3 rental indices (1999 = 100).
 *  RVD does not publish the 18 District Council areas; figures are Hong Kong / Kowloon / New Territories.
 */

export type RentClass = "A" | "B" | "C" | "D" | "E";
export type RentRegion = "hk" | "kln" | "nt";

export const CLASSES: { id: RentClass; zh: string; en: string; hintZh: string; hintEn: string }[] = [
  { id: "A", zh: "A 類", en: "Class A", hintZh: "430 平方呎以下", hintEn: "Under about 430 sq ft" },
  { id: "B", zh: "B 類", en: "Class B", hintZh: "430–750 平方呎", hintEn: "About 430–750 sq ft" },
  { id: "C", zh: "C 類", en: "Class C", hintZh: "750–1,070 平方呎", hintEn: "About 750–1,070 sq ft" },
  { id: "D", zh: "D 類", en: "Class D", hintZh: "1,070–1,720 平方呎", hintEn: "About 1,070–1,720 sq ft" },
  { id: "E", zh: "E 類", en: "Class E", hintZh: "1,720 平方呎或以上", hintEn: "About 1,720 sq ft or more" },
];

type Cell = { hk: number; kln: number; nt: number; thin: RentRegion[] };

/** YYYY-MM for LATEST_RENTS (RVD provisional regional averages). */
export const LATEST_RENTS_YM = "2026-04";

/** April 2026 provisional average rents, $/m² per month. */
export const LATEST_RENTS: Record<RentClass, Cell> = {
  A: { hk: 515, kln: 433, nt: 355, thin: [] },
  B: { hk: 429, kln: 393, nt: 287, thin: [] },
  C: { hk: 483, kln: 421, nt: 289, thin: [] },
  D: { hk: 462, kln: 421, nt: 265, thin: [] },
  E: { hk: 420, kln: 541, nt: 275, thin: ["kln", "nt"] },
};

/** Territory-wide private domestic rental index, all classes. Starred months are provisional. */
export type RentIndexPoint = { ym: string; value: number; provisional: boolean };

export const RENT_INDEX: RentIndexPoint[] = [
  { ym: "2025-04", value: 193.9, provisional: false },
  { ym: "2025-05", value: 194.2, provisional: false },
  { ym: "2025-06", value: 195.9, provisional: false },
  { ym: "2025-07", value: 197.4, provisional: false },
  { ym: "2025-08", value: 199.8, provisional: false },
  { ym: "2025-09", value: 199.9, provisional: false },
  { ym: "2025-10", value: 199.9, provisional: false },
  { ym: "2025-11", value: 200.4, provisional: false },
  { ym: "2026-12", value: 200.5, provisional: false },
  { ym: "2026-01", value: 200.8, provisional: false },
  { ym: "2026-02", value: 201.0, provisional: true },
  { ym: "2026-03", value: 202.2, provisional: true },
  { ym: "2026-04", value: 203.4, provisional: true },
];

export const INDEX_YEAR = { y2024: 190.5, y2025: 196.7 };

const SQFT_TO_SQM = 0.09290304;

export function regionOf(districtId: string): RentRegion {
  const row = DISTRICTS.find((d) => d.id === districtId);
  if (row?.region === "hk" || row?.region === "kln") return row.region;
  return "nt";
}

export function classFromSqft(sqft: number): RentClass {
  const m2 = sqft * SQFT_TO_SQM;
  if (m2 < 40) return "A";
  if (m2 < 70) return "B";
  if (m2 < 100) return "C";
  if (m2 < 160) return "D";
  return "E";
}

export function perSqftFromSqm(perSqm: number) {
  return Math.round(perSqm * SQFT_TO_SQM);
}

export function estimateRent(sqft: number, region: RentRegion, rentClass: RentClass) {
  const cell = LATEST_RENTS[rentClass];
  const perSqft = perSqftFromSqm(cell[region]);
  return { perSqft, monthly: perSqft * sqft, thin: cell.thin.includes(region) };
}

export function indexChange(series: RentIndexPoint[] = RENT_INDEX) {
  const first = series[0];
  const last = series[series.length - 1];
  const pct = ((last.value - first.value) / first.value) * 100;
  return { first, last, pct };
}

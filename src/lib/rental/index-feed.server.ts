import * as XLSX from "xlsx";
import { RENT_INDEX, type RentIndexPoint } from "./market";

const SOURCE = "https://www.rvd.gov.hk/doc/en/statistics/his_data_3.xls";
const DAY_MS = 24 * 60 * 60 * 1000;

export type RentIndexFeed = {
  series: RentIndexPoint[];
  fetchedAt: string | null;
  source: "rvd" | "fallback";
};

const cache = globalThis as typeof globalThis & { __rentIndexFeed?: RentIndexFeed };

function asNumber(cell: unknown): number | null {
  if (cell === null || cell === undefined || cell === "") return null;
  const value = Number(cell);
  return Number.isFinite(value) ? value : null;
}

export function parseRentIndexSheet(data: Buffer): RentIndexPoint[] {
  const book = XLSX.read(data, { type: "buffer" });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: true, defval: null });
  let valueCol = -1;
  for (const row of rows.slice(0, 12)) {
    const found = row.findIndex((cell) => {
      const text = String(cell ?? "");
      return text.includes("All Classes") || text.includes("所有類別");
    });
    if (found >= 0) valueCol = found;
  }
  if (valueCol < 0) throw new Error("All Classes column missing");
  const sample = rows.find((row) => {
    const month = Number(row[5]);
    return month >= 1 && month <= 12;
  });
  if (sample && asNumber(sample[valueCol]) === null && asNumber(sample[valueCol + 1]) !== null) {
    valueCol += 1;
  }

  let year = 0;
  const points: RentIndexPoint[] = [];
  for (const row of rows) {
    const yearCell = asNumber(row[1]);
    if (yearCell !== null && yearCell >= 1979 && yearCell <= 2100) year = yearCell;
    const month = asNumber(row[5]);
    const value = asNumber(row[valueCol]);
    if (!year || month === null || month < 1 || month > 12 || value === null || value <= 0) continue;
    points.push({
      ym: `${year}-${String(month).padStart(2, "0")}`,
      value: Math.round(value * 10) / 10,
      provisional: String(row[6] ?? "").includes("*"),
    });
  }
  return points.slice(-13);
}

export async function loadRentIndex(): Promise<RentIndexFeed> {
  const saved = cache.__rentIndexFeed;
  if (saved?.source === "rvd" && saved.fetchedAt && Date.now() - Date.parse(saved.fetchedAt) < DAY_MS) {
    return saved;
  }
  try {
    const response = await fetch(SOURCE, {
      signal: AbortSignal.timeout(12_000),
      headers: { "User-Agent": "EasyRentalHK" },
    });
    if (!response.ok) throw new Error(String(response.status));
    const series = parseRentIndexSheet(Buffer.from(await response.arrayBuffer()));
    if (series.length < 6) throw new Error(`short series ${series.length}`);
    const next: RentIndexFeed = { series, fetchedAt: new Date().toISOString(), source: "rvd" };
    cache.__rentIndexFeed = next;
    return next;
  } catch (error) {
    console.error("[rent-index] refresh failed", error);
    if (saved) return saved;
    return { series: RENT_INDEX, fetchedAt: null, source: "fallback" };
  }
}

import type { DepositPaidStatus, Lang, Payment, Tenancy } from "./types";

export function todayISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function monthKey(d = new Date()) {
  return todayISO(d).slice(0, 7);
}

export function hkd(n: number, lang: Lang) {
  return new Intl.NumberFormat(lang === "zh" ? "zh-HK" : "en-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(iso: string, lang: Lang) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}


/** Compare 應收按金 vs 已收金額. Never treats missing paid amount as paid. */
export function depositState(lease: Pick<Tenancy, "deposit" | "depositPaidAmount">): DepositPaidStatus {
  const owed = lease.deposit;
  const paid = lease.depositPaidAmount ?? 0;
  if (paid <= 0) return "unpaid";
  if (owed > 0 && paid >= owed) return "paid";
  if (paid > 0 && (owed <= 0 || paid < owed)) return "partial";
  return "unpaid";
}

export function paymentState(p: Payment, today = todayISO()): "paid" | "partial" | "overdue" | "due" {
  if (p.paidAmount >= p.amount && p.amount > 0) return "paid";
  if (p.paidAmount > 0) return "partial";
  if (p.dueDate < today) return "overdue";
  return "due";
}

export function daysUntil(iso: string, today = todayISO()) {
  const a = new Date(today + "T00:00:00");
  const b = new Date(iso + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export const RENEW_WITHIN_DAYS = 90;

export function whatsappToMe(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function renewalText(input: {
  lang: "zh" | "en";
  tenant: string;
  property: string;
  end: string;
  days: number;
}) {
  if (input.lang === "zh") {
    if (input.days < 0) {
      return `提醒：${input.property}（${input.tenant}）的租約已於 ${input.end} 結束。請盡快同租客確認續約或退租。`;
    }
    return `提醒：${input.property}（${input.tenant}）的租約將於 ${input.end} 到期，還有 ${input.days} 日。現在應聯絡租客談續約。`;
  }
  if (input.days < 0) {
    return `Reminder: the lease for ${input.property} (${input.tenant}) ended on ${input.end}. Confirm a renewal or a move-out.`;
  }
  return `Reminder: the lease for ${input.property} (${input.tenant}) ends on ${input.end}, in ${input.days} days. Contact the tenant about renewal now.`;
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function dueDateFor(period: string, dueDay: number) {
  const [y, m] = period.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(dueDay, 1), last);
  return `${period}-${String(day).padStart(2, "0")}`;
}

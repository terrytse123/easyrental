import type { Lang, Payment } from "./types";

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

export function whatsappHref(phone: string, text: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("852") && digits.length === 11) {
    /* already a Hong Kong mobile number */
  } else if (digits.length === 8) digits = `852${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function rentNotice(input: {
  lang: "zh" | "en";
  tenant: string;
  property: string;
  period: string;
  amount: string;
  due: string;
}) {
  if (input.lang === "zh") {
    return `${input.tenant}你好，${input.property} ${input.period} 的租金 ${input.amount} 將於 ${input.due} 到期，請安排繳付。謝謝。`;
  }
  return `Hello ${input.tenant}, rent of ${input.amount} for ${input.property} (${input.period}) is due on ${input.due}. Please arrange payment. Thank you.`;
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

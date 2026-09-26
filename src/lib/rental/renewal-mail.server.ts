import { sendMail } from "@/lib/auth/mail.server";
import { getSql } from "@/lib/db";
import { daysUntil, RENEW_WITHIN_DAYS } from "@/lib/rental/format";
import { asLedger } from "@/lib/rental/ledger.functions";
import type { RentalData, Tenancy } from "@/lib/rental/types";

type Due = { tenancyId: string; end: string; line: string };

function hongKongToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts.slice(0, 10);
}

function dueLines(ledger: RentalData, today: string): Due[] {
  return ledger.tenancies
    .filter((lease) => lease.active && daysUntil(lease.end, today) <= RENEW_WITHIN_DAYS)
    .map((lease) => lineFor(ledger, lease, today))
    .filter((row): row is Due => Boolean(row));
}

function lineFor(ledger: RentalData, lease: Tenancy, today: string): Due | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lease.end)) return null;
  const property = ledger.properties.find((item) => item.id === lease.propertyId);
  const tenant = ledger.tenants.find((item) => item.id === lease.tenantId);
  const name = property?.name || "單位";
  const who = tenant?.name || "租客";
  const days = daysUntil(lease.end, today);
  const line =
    days < 0
      ? `${name}（${who}）的租約已於 ${lease.end} 結束。請盡快確認續約或退租。`
      : `${name}（${who}）的租約將於 ${lease.end} 到期，還有 ${days} 日。請聯絡租客談續約。`;
  return { tenancyId: lease.id, end: lease.end, line };
}

async function alreadySent(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ tenancy_id: string; lease_end: string }>(
    `select tenancy_id, lease_end from renewal_mails where user_id = $1`,
    [userId],
  );
  return new Set(rows.map((row) => `${row.tenancy_id}|${row.lease_end}`));
}

async function remember(userId: string, rows: Due[]) {
  const sql = await getSql();
  for (const row of rows) {
    await sql.query(
      `insert into renewal_mails (user_id, tenancy_id, lease_end) values ($1, $2, $3) on conflict do nothing`,
      [userId, row.tenancyId, row.end],
    );
  }
}

export async function mailDueRenewals(userId: string): Promise<{ sent: boolean; error?: string }> {
  const sql = await getSql();
  const users = await sql.query<{ email: string; name: string }>(
    `select email, name from app_users where id = $1`,
    [userId],
  );
  const user = users[0];
  if (!user?.email) return { sent: false };
  const ledgers = await sql.query<{ payload: unknown }>(`select payload from ledgers where user_id = $1`, [userId]);
  if (!ledgers[0]) return { sent: false };
  let ledger: RentalData;
  try {
    const raw = ledgers[0].payload;
    ledger = asLedger(typeof raw === "string" ? JSON.parse(raw) : raw);
  } catch {
    return { sent: false };
  }
  const due = dueLines(ledger, hongKongToday());
  const sent = await alreadySent(userId);
  const fresh = due.filter((row) => !sent.has(`${row.tenancyId}|${row.end}`));
  if (!fresh.length) return { sent: false };
  const text = `你好 ${user.name}，\n\n以下租約需要你跟進。這封信只寄給你，沒有寄給租客。\n\n${fresh.map((row) => `- ${row.line}`).join("\n")}\n\n香港租租`;
  const result = await sendMail(user.email, "香港租租：租約續約提醒", text);
  if (!result.ok) return { sent: false, error: result.error };
  await remember(userId, fresh);
  return { sent: true };
}

export async function mailRenewalTest(userId: string): Promise<{ ok: boolean }> {
  const sql = await getSql();
  const users = await sql.query<{ email: string; name: string }>(
    `select email, name from app_users where id = $1`,
    [userId],
  );
  const user = users[0];
  if (!user?.email) return { ok: false };
  const result = await sendMail(
    user.email,
    "香港租租：續約提醒測試",
    `你好 ${user.name}，\n\n這是一封測試。真正的續約提醒會在租約到期前三個月寄到這個電郵，每個租約只寄一次。不會寄給租客。\n\n香港租租`,
  );
  return { ok: result.ok };
}

export async function mailAllDueRenewals() {
  const sql = await getSql();
  const users = await sql.query<{ id: string }>(
    `select u.id from app_users u join ledgers l on l.user_id = u.id`,
  );
  let sent = 0;
  for (const user of users) {
    const result = await mailDueRenewals(user.id);
    if (result.sent) sent += 1;
  }
  return { users: users.length, sent };
}

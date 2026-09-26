import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type LeaseFile = {
  id: string;
  tenancyId: string;
  kind: "lease" | "stamp" | "deposit";
  created: string;
  payload: string;
};

function asKind(value: string): "lease" | "stamp" | "deposit" {
  if (value === "lease" || value === "stamp" || value === "deposit") return value;
  throw new Error("bad kind");
}

function asPayload(value: string) {
  if (!value.startsWith("data:image/jpeg;base64,") || value.length > 500_000) {
    throw new Error("bad image");
  }
  return value;
}

export const listLeaseFiles = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((tenancyId: string) => {
    if (!tenancyId || tenancyId.length > 80) throw new Error("bad tenancy");
    return tenancyId;
  })
  .handler(async ({ context, data: tenancyId }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string; kind: string; created: string; payload: string }>(
      `select id, kind, to_char(created_at at time zone 'Asia/Hong_Kong', 'YYYY-MM-DD') as created, payload
       from lease_files
       where user_id = $1 and tenancy_id = $2
       order by created_at`,
      [context.userId, tenancyId],
    );
    return rows.map((row) => {
      const kind: LeaseFile["kind"] = row.kind === "stamp" ? "stamp" : row.kind === "deposit" ? "deposit" : "lease";
      return {
        id: row.id,
        tenancyId,
        kind,
        created: row.created,
        payload: row.payload,
      };
    });
  });

export const addLeaseFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { tenancyId: string; kind: string; payload: string }) => ({
    tenancyId: input.tenancyId,
    kind: asKind(input.kind),
    payload: asPayload(input.payload),
  }))
  .handler(async ({ context, data }) => {
    if (!data.tenancyId || data.tenancyId.length > 80) throw new Error("bad tenancy");
    const sql = await getSql();
    const counts = await sql.query<{ n: number }>(
      `select count(*)::int as n from lease_files where user_id = $1 and tenancy_id = $2 and kind = $3`,
      [context.userId, data.tenancyId, data.kind],
    );
    if ((counts[0]?.n ?? 0) >= 12) throw new Error("too many");
    const id = randomBytes(12).toString("hex");
    await sql.query(
      `insert into lease_files (id, user_id, tenancy_id, kind, payload) values ($1, $2, $3, $4, $5)`,
      [id, context.userId, data.tenancyId, data.kind, data.payload],
    );
    return { id };
  });

export const removeLeaseFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => {
    if (!id || id.length > 80) throw new Error("bad id");
    return id;
  })
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql.query(`delete from lease_files where id = $1 and user_id = $2`, [id, context.userId]);
    return { ok: true as const };
  });

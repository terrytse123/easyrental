/** Pure helpers for account open / reset transport (unit-tested). */

export function cookieShouldBeSecure(input: {
  nodeEnv?: string | null;
  requestUrl: string;
  forwardedProto?: string | null;
}): boolean {
  if (input.nodeEnv === "production") return true;
  try {
    if (new URL(input.requestUrl).protocol === "https:") return true;
  } catch {
    /* ignore bad URL */
  }
  const proto = (input.forwardedProto ?? "").split(",")[0]?.trim().toLowerCase();
  return proto === "https";
}

/** GET must never carry a password (or password-change `next`) in the query string. */
export function rejectGetWithSecretParams(
  method: string,
  searchParams: { get(name: string): string | null },
): boolean {
  if (method.toUpperCase() !== "GET") return false;
  const password = searchParams.get("password");
  if (password != null && password.length > 0) return true;
  const next = searchParams.get("next");
  if (next != null && next.length > 0 && searchParams.get("mode") === "password") return true;
  return false;
}

/** First reset step only emails a code; must not write password_hash. */
export function resetModeSendsCodeOnly(mode: string): boolean {
  return mode === "reset";
}

/** Confirm step may update password_hash only after OTP matches. */
export function resetModeUpdatesPassword(mode: string): boolean {
  return mode === "reset-code";
}

export function sessionCookieHeader(token: string | null, secure: boolean): string {
  const flags = `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  if (!token) return `er_session=; ${flags}; Max-Age=0`;
  return `er_session=${token}; ${flags}; Max-Age=1209600`;
}

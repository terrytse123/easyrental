import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function codesMatch(code: string, salt: string, hash: string): boolean {
  const next = Buffer.from(hashCode(code.trim(), salt));
  const prev = Buffer.from(hash);
  return next.length === prev.length && timingSafeEqual(next, prev);
}

export function newEmailCode(): { code: string; salt: string; hash: string } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  return { code, salt, hash: hashCode(code, salt) };
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of input.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

export function currentTotp(secret: string, at = Date.now()): string {
  return hotp(base32Decode(secret), Math.floor(at / 30_000));
}

export function verifyTotp(secret: string, token: string, at = Date.now()): boolean {
  const clean = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(at / 30_000);
  for (let drift = -1; drift <= 1; drift += 1) {
    if (hotp(base32Decode(secret), counter + drift) === clean) return true;
  }
  return false;
}

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function otpauthUrl(email: string, secret: string): string {
  const label = encodeURIComponent(`EasyRentalHK:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=EasyRentalHK&digits=6&period=30`;
}

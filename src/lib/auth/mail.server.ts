import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";

type Sent = { ok: true } | { ok: false; error: string };

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]/g, "").trim();
}

function headerValue(value: string): string {
  const clean = value.replace(/[\r\n]/g, "").trim();
  const named = clean.match(/^(.*?)\s*<([^>]+)>$/);
  if (named) {
    const name = named[1].trim().replace(/^"|"$/g, "");
    const email = named[2].trim();
    const encoded = /^[\x00-\x7F]*$/.test(name) ? name : `=?UTF-8?B?${Buffer.from(name, "utf8").toString("base64")}?=`;
    return `${encoded} <${email}>`;
  }
  if (/^[\x00-\x7F]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

/** Send a plain-text message. Uses Resend when RESEND_API_KEY is set, otherwise SMTP. */
export async function sendMail(to: string, subject: string, text: string): Promise<Sent> {
  const recipient = cleanHeader(to);
  const title = cleanHeader(subject);
  const key = process.env.RESEND_API_KEY?.trim();
  if (key) {
    const from = cleanHeader(process.env.MAIL_FROM || "EasyRentalHK <onboarding@resend.dev>");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [recipient], subject: title, text }),
    });
    if (!response.ok) return { ok: false, error: `resend ${response.status}` };
    return { ok: true };
  }
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS ?? "";
  if (!host || !user || !pass) return { ok: false, error: "mail-not-configured" };
  const from = cleanHeader(process.env.MAIL_FROM || user);
  return smtpSend({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    user,
    pass,
    from,
    to: recipient,
    subject: title,
    text,
  });
}

export function verificationLetter(code: string): { subject: string; text: string } {
  return {
    subject: "香港租租 電郵驗證碼",
    text: `你的香港租租驗證碼是 ${code}\n\n請於 10 分鐘內在開戶頁輸入。如非你本人申請，請忽略這封電郵。\n`,
  };
}

function readCode(socket: Socket): Promise<number> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] ?? "";
      if (last.length < 4 || last[3] === "-") return;
      socket.off("data", onData);
      resolve(Number(last.slice(0, 3)));
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

function expect(status: number, allowed: number[]) {
  if (!allowed.includes(status)) throw new Error(`smtp-${status}`);
}

async function authAndSend(socket: Socket, input: {
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  socket.write("EHLO easyrentalhk\r\n");
  expect(await readCode(socket), [250]);
  socket.write("AUTH LOGIN\r\n");
  expect(await readCode(socket), [334]);
  socket.write(`${Buffer.from(input.user).toString("base64")}\r\n`);
  expect(await readCode(socket), [334]);
  socket.write(`${Buffer.from(input.pass).toString("base64")}\r\n`);
  expect(await readCode(socket), [235]);
  const from = input.from.match(/<([^>]+)>/)?.[1] || input.from;
  socket.write(`MAIL FROM:<${from}>\r\n`);
  expect(await readCode(socket), [250]);
  socket.write(`RCPT TO:<${input.to}>\r\n`);
  expect(await readCode(socket), [250, 251]);
  socket.write("DATA\r\n");
  expect(await readCode(socket), [354]);
  socket.write(
    `From: ${headerValue(input.from)}\r\nTo: ${input.to}\r\nSubject: ${headerValue(input.subject)}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${input.text}\r\n.\r\n`,
  );
  expect(await readCode(socket), [250]);
  socket.write("QUIT\r\n");
}

function smtpSend(input: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<Sent> {
  return new Promise((resolve) => {
    const finish = (result: Sent) => resolve(result);
    const timer = setTimeout(() => finish({ ok: false, error: "smtp-timeout" }), 8000);
    const done = (result: Sent) => {
      clearTimeout(timer);
      finish(result);
    };
    const start = input.port === 465
      ? tlsConnect({ host: input.host, port: input.port, servername: input.host })
      : netConnect({ host: input.host, port: input.port });
    start.once("error", () => done({ ok: false, error: "smtp-failed" }));
    void (async () => {
      try {
        expect(await readCode(start), [220]);
        let socket: Socket = start;
        if (input.port !== 465) {
          start.write("EHLO easyrentalhk\r\n");
          expect(await readCode(start), [250]);
          start.write("STARTTLS\r\n");
          expect(await readCode(start), [220]);
          socket = tlsConnect({ socket: start, servername: input.host });
          await new Promise<void>((ok, bad) => {
            socket.once("secureConnect", () => ok());
            socket.once("error", bad);
          });
        }
        await authAndSend(socket, input);
        socket.end();
        done({ ok: true });
      } catch (error) {
        start.destroy();
        done({ ok: false, error: error instanceof Error ? error.message : "smtp-failed" });
      }
    })();
  });
}

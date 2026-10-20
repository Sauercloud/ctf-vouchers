import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";

// https://documentation.mailgun.com/docs/mailgun/user-manual/tracking-messages/#securing-webhooks
export function verifySignature(
  signingKey: string,
  timestamp: string,
  token: string,
  signature: string,
): boolean {
  if (!signingKey || !timestamp || !token || !signature) return false;
  const expected = createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class MailgunError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
}

export async function sendMail(mail: Mail): Promise<string> {
  if (config.mailDryRun) {
    console.log(`[mail dry-run] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return `dry-run-${Date.now()}`;
  }

  const body = new URLSearchParams({
    from: config.mailFrom,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    "o:tracking": "no",
  });
  if (mail.replyTo) body.set("h:Reply-To", mail.replyTo);

  const res = await fetch(`${config.mailgunApiBase}/v3/${config.mailDomain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${config.mailgunApiKey}`).toString("base64")}`,
    },
    body,
    // A hung request would block every later tick.
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new MailgunError(`Mailgun ${res.status}: ${await res.text()}`, res.status);
  }
  const json = (await res.json()) as { id?: string };
  return json.id ?? "";
}

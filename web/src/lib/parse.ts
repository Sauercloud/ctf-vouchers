// Helpers for interpreting mails forwarded by Mailgun.

export type Headers = Record<string, string[]>;

// Mailgun sends `message-headers` as a JSON list of [name, value] pairs.
export function parseHeaders(raw: string | null | undefined): Headers {
  const headers: Headers = {};
  if (!raw) return headers;
  try {
    for (const [name, value] of JSON.parse(raw) as [string, string][]) {
      (headers[name.toLowerCase()] ??= []).push(String(value));
    }
  } catch {
    // keep what we have
  }
  return headers;
}

export function header(headers: Headers, name: string): string | undefined {
  return headers[name.toLowerCase()]?.[0];
}

export function extractCodes(text: string, pattern: string): string[] {
  const codes = new Set<string>();
  for (const match of text.matchAll(new RegExp(pattern, "g"))) {
    codes.add(match[0]);
  }
  return [...codes];
}

// "Name <user@example.org>" -> "user@example.org"
export function bareAddress(address: string): string {
  const m = address.match(/<([^>]+)>/);
  return (m ? m[1] : address).trim().toLowerCase();
}

// Entries starting with "@" match a whole domain, others a full address.
export function addressAllowed(address: string, allowlist: readonly string[]) {
  const addr = bareAddress(address);
  return allowlist.some((entry) =>
    entry.startsWith("@") ? addr.endsWith(entry) : addr === entry,
  );
}

export function isAutoReply(headers: Headers): boolean {
  const auto = header(headers, "auto-submitted")?.toLowerCase();
  if (auto && auto !== "no") return true;
  if (header(headers, "x-autoreply") || header(headers, "x-autorespond")) return true;
  const precedence = header(headers, "precedence")?.toLowerCase();
  return precedence === "auto_reply" || precedence === "bulk" || precedence === "junk";
}

function dkimTag(sig: string, tag: string): string | undefined {
  return sig.match(new RegExp(`(?:^|;)\\s*${tag}=([^;]+)`))?.[1]?.replace(/\s+/g, "");
}

// Trust a mail from the CCC only if Mailgun verified DKIM and every DKIM
// signature belongs to an allowlisted domain. A second check-result header
// can only come from the sender, so that is never trusted.
export function dkimTrusted(headers: Headers, allowlist: readonly string[]) {
  const results = headers["x-mailgun-dkim-check-result"] ?? [];
  if (results.length !== 1 || results[0].trim().toLowerCase() !== "pass") return false;
  const domains = allowlist.filter((e) => e.startsWith("@")).map((e) => e.slice(1));
  const signatures = headers["dkim-signature"] ?? [];
  return (
    signatures.length > 0 &&
    signatures.every((sig) => {
      const d = dkimTag(sig, "d")?.toLowerCase();
      return d !== undefined && domains.some((dom) => d === dom || d.endsWith(`.${dom}`));
    })
  );
}

// A DKIM-valid mail proves only that the CCC sent it to someone. Bind it to
// the replication address it arrived at: the single To: header must be that
// address and every signature must cover To:, so a CCC mail sent elsewhere
// (e.g. to the team itself) cannot be replayed. Signatures older than
// `notBefore` (the assignment) belong to an older mail.
export function dkimBoundTo(headers: Headers, address: string, notBefore: Date) {
  const to = headers["to"] ?? [];
  if (to.length !== 1 || to[0].includes(",") || bareAddress(to[0]) !== address.toLowerCase()) {
    return false;
  }
  const signatures = headers["dkim-signature"] ?? [];
  return (
    signatures.length > 0 &&
    signatures.every((sig) => {
      const signed = (dkimTag(sig, "h") ?? "").toLowerCase().split(":");
      const t = Number(dkimTag(sig, "t"));
      // allow some clock skew between the CCC and us
      return signed.includes("to") && Number.isFinite(t) && t * 1000 >= notBefore.getTime() - 5 * 60_000;
    })
  );
}

export type Recipient =
  | { kind: "seed" }
  | { kind: "replica"; token: string }
  | { kind: "confirm"; token: string }
  | { kind: "other" };

export function classifyRecipient(
  address: string,
  domain: string,
  seedSecret: string,
): Recipient {
  const addr = bareAddress(address);
  const at = addr.lastIndexOf("@");
  if (at < 0 || addr.slice(at + 1) !== domain.toLowerCase()) return { kind: "other" };
  const local = addr.slice(0, at);
  if (seedSecret && local === `seed-${seedSecret.toLowerCase()}`) return { kind: "seed" };
  const m = local.match(/^([vc])-([0-9a-f]{32})$/);
  if (!m) return { kind: "other" };
  return m[1] === "v" ? { kind: "replica", token: m[2] } : { kind: "confirm", token: m[2] };
}

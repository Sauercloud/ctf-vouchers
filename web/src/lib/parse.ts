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

// Mailgun's inbound MX (mxa.eu.mailgun.org, mxb.mailgun.org, ...).
const MAILGUN_AUTHSERV = /^mx[a-z0-9]*\.(?:eu\.)?mailgun\.org$/;

// DKIM results from Mailgun's Authentication-Results header (RFC 8601), e.g.
// "mxa.eu.mailgun.org; dkim=pass header.d=cccv.de header.s=presale; spf=pass".
// Returns null unless there is exactly one such header: one the sender added
// with a Mailgun authserv-id makes two, so it is never trusted.
function mailgunDkimResults(headers: Headers) {
  const parsed = (headers["authentication-results"] ?? []).map((value) =>
    // comments like "(dkim=pass; spf=pass)" in the dmarc result are not results
    value.replace(/\([^)]*\)/g, "").split(";").map((part) => part.trim()),
  );
  const mailgun = parsed.filter(([authserv]) => MAILGUN_AUTHSERV.test(authserv.split(/\s+/)[0].toLowerCase()));
  if (mailgun.length !== 1) return null;
  return mailgun[0]
    .slice(1)
    .map((part) => part.match(/^dkim=(\S+)(?:.*?\bheader\.d=(\S+))?/i))
    .filter((m) => m !== null)
    .map((m) => ({ result: m[1].toLowerCase(), domain: m[2]?.toLowerCase() }));
}

const inDomains = (d: string | undefined, domains: string[]) =>
  d !== undefined && domains.some((dom) => d === dom || d.endsWith(`.${dom}`));

// Trust a mail from the CCC only if Mailgun verified DKIM for allowlisted
// domains only and every DKIM signature belongs to one. Signatures with a
// body length limit (l=) are rejected, since text could be appended.
export function dkimTrusted(headers: Headers, allowlist: readonly string[]) {
  const domains = allowlist.filter((e) => e.startsWith("@")).map((e) => e.slice(1));
  const results = mailgunDkimResults(headers);
  if (!results?.length || !results.every((r) => r.result === "pass" && inDomains(r.domain, domains))) {
    return false;
  }
  const signatures = headers["dkim-signature"] ?? [];
  return (
    signatures.length > 0 &&
    signatures.every((sig) => inDomains(dkimTag(sig, "d")?.toLowerCase(), domains) && dkimTag(sig, "l") === undefined)
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

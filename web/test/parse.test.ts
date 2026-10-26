import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addressAllowed,
  classifyRecipient,
  dkimBoundTo,
  dkimTrusted,
  extractCodes,
  isAutoReply,
  parseHeaders,
} from "@/lib/parse";
import { parseEml } from "../scripts/eml";

const REGEX = "\\bCHAOS[A-Z0-9]{32}\\b";
const eml = parseEml(readFileSync(`${__dirname}/fixtures/ccc-voucher.eml`, "utf8"));
const headersOf = (pairs: [string, string][]) => parseHeaders(JSON.stringify(pairs));

describe("extractCodes", () => {
  it("finds the single code in the CCC mail although it appears twice", () => {
    expect(eml.from).toContain("39c3-tickets@cccv.de");
    expect(extractCodes(eml.bodyPlain, REGEX)).toEqual(["CHAOSTESTTESTTESTTESTTESTTESTTEST2345"]);
  });

  it("finds all codes in a forwarded mail", () => {
    const fwd = `---------- Forwarded message ---------
> Your vouchers:
>   CHAOSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2
>   CHAOSBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB3
>   CHAOSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2`;
    expect(extractCodes(fwd, REGEX)).toEqual([
      "CHAOSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2",
      "CHAOSBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB3",
    ]);
  });

  it("ignores too short or too long codes", () => {
    expect(extractCodes("CHAOSABC CHAOSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", REGEX)).toEqual([]);
  });
});

describe("classifyRecipient", () => {
  const token = "0123456789abcdef0123456789abcdef";
  it.each([
    [`v-${token}@ctf-vouchers.de`, { kind: "replica", token }],
    [`C-${token.toUpperCase()}@CTF-vouchers.de`, { kind: "confirm", token }],
    [`"x" <seed-s3cret@ctf-vouchers.de>`, { kind: "seed" }],
    [`seed-wrong@ctf-vouchers.de`, { kind: "other" }],
    [`v-${token}@evil.de`, { kind: "other" }],
    [`v-1234@ctf-vouchers.de`, { kind: "other" }],
    [`mail@ctf-vouchers.de`, { kind: "other" }],
  ])("%s", (addr, expected) => {
    expect(classifyRecipient(addr, "ctf-vouchers.de", "s3cret")).toEqual(expected);
  });

  it("never matches the seed address without a secret", () => {
    expect(classifyRecipient("seed-@ctf-vouchers.de", "ctf-vouchers.de", "")).toEqual({ kind: "other" });
  });
});

describe("senders", () => {
  it("matches domains and full addresses", () => {
    expect(addressAllowed("40C3 <40c3-tickets@cccv.de>", ["@cccv.de"])).toBe(true);
    expect(addressAllowed("x@notcccv.de", ["@cccv.de"])).toBe(false);
    expect(addressAllowed("Admin <Me@Example.org>", ["me@example.org"])).toBe(true);
  });

  it("detects auto replies", () => {
    expect(isAutoReply(headersOf(eml.headers))).toBe(true);
    expect(isAutoReply(headersOf([["Auto-Submitted", "no"]]))).toBe(false);
    expect(isAutoReply(headersOf([["Precedence", "auto_reply"]]))).toBe(true);
    expect(isAutoReply(headersOf([["Subject", "redeemed"]]))).toBe(false);
  });

  // As Mailgun's EU MX added it to a real 40C3 replica mail.
  const pass: [string, string] = [
    "Authentication-Results",
    'mxa.eu.mailgun.org; dkim=pass header.d=cccv.de header.s=presale header.b=r41x1KUh; spf=pass (domain cccv.de designates 167.235.195.219 as permitted sender) smtp.mailfrom="40c3-tickets@cccv.de"; dmarc=pass (dkim=pass domain=cccv.de; spf=pass domain=cccv.de) header.from=cccv.de',
  ];
  const ar = (value: string): [string, string] => ["Authentication-Results", value];

  it("trusts DKIM only when Mailgun passed it and all signatures are from the CCC", () => {
    expect(dkimTrusted(headersOf([...eml.headers, pass]), ["@cccv.de"])).toBe(true);
    expect(dkimTrusted(headersOf(eml.headers), ["@cccv.de"])).toBe(false);
    expect(
      dkimTrusted(headersOf([pass, ["DKIM-Signature", "v=1; a=rsa-sha256; d=evil.de; s=x"]]), ["@cccv.de"]),
    ).toBe(false);
    expect(
      dkimTrusted(
        headersOf([...eml.headers, pass, ["DKIM-Signature", "v=1; d=evil.de; s=x"]]),
        ["@cccv.de"],
      ),
    ).toBe(false);
    const failed = ar("mxa.eu.mailgun.org; dkim=fail header.d=cccv.de; spf=pass smtp.mailfrom=x@cccv.de");
    expect(dkimTrusted(headersOf([...eml.headers, failed]), ["@cccv.de"])).toBe(false);
    const other = ar("mxa.eu.mailgun.org; dkim=pass header.d=cccv.de; dkim=pass header.d=evil.de");
    expect(dkimTrusted(headersOf([...eml.headers, other]), ["@cccv.de"])).toBe(false);
    // the "dkim=pass" in the dmarc comment is not a result
    const commentOnly = ar("mxa.eu.mailgun.org; dmarc=pass (dkim=pass header.d=cccv.de) header.from=cccv.de");
    expect(dkimTrusted(headersOf([...eml.headers, commentOnly]), ["@cccv.de"])).toBe(false);
  });

  it("does not trust check results added by the sender", () => {
    // Mailgun stopped adding this header, so it can only come from the sender
    expect(dkimTrusted(headersOf([...eml.headers, ["X-Mailgun-Dkim-Check-Result", "Pass"]]), ["@cccv.de"])).toBe(false);
    expect(dkimTrusted(headersOf([...eml.headers, ar("mx.evil.de; dkim=pass header.d=cccv.de")]), ["@cccv.de"])).toBe(false);
    const forged = ar("mxa.eu.mailgun.org; dkim=pass header.d=cccv.de");
    expect(dkimTrusted(headersOf([pass, ...eml.headers, forged]), ["@cccv.de"])).toBe(false);
    expect(dkimTrusted(headersOf([forged, ...eml.headers, ar("mxb.mailgun.org; dkim=fail header.d=x.de")]), ["@cccv.de"])).toBe(false);
  });

  it("rejects signatures with a body length limit", () => {
    const limited = eml.headers.map(([k, v]): [string, string] =>
      k.toLowerCase() === "dkim-signature" ? [k, v.replace("s=presale;", "s=presale; l=100;")] : [k, v],
    );
    expect(limited).not.toEqual(eml.headers);
    expect(dkimTrusted(headersOf([...limited, pass]), ["@cccv.de"])).toBe(false);
  });
});

describe("dkimBoundTo", () => {
  const address = `v-${"a".repeat(32)}@ctf-vouchers.de`;
  const signedAt = new Date(1762204274 * 1000);
  const before = new Date(signedAt.getTime() - 3600_000);
  const withTo = (...to: string[]) =>
    headersOf([...eml.headers.filter(([k]) => k.toLowerCase() !== "to"), ...to.map((t): [string, string] => ["To", t])]);

  it("accepts a signed mail to the replication address", () => {
    expect(dkimBoundTo(withTo(address), address, before)).toBe(true);
    expect(dkimBoundTo(withTo(`Team <${address.toUpperCase()}>`), address, before)).toBe(true);
  });

  it("rejects a mail the CCC sent elsewhere", () => {
    expect(dkimBoundTo(headersOf(eml.headers), address, before)).toBe(false);
    expect(dkimBoundTo(withTo(address, "vorstand@alles.team"), address, before)).toBe(false);
    expect(dkimBoundTo(withTo(`${address}, vorstand@alles.team`), address, before)).toBe(false);
  });

  it("rejects mails signed before the assignment", () => {
    expect(dkimBoundTo(withTo(address), address, new Date(signedAt.getTime() + 3600_000))).toBe(false);
  });

  it("rejects signatures that do not cover To", () => {
    const unsigned = withTo(address);
    unsigned["dkim-signature"] = unsigned["dkim-signature"].map((sig) => sig.replace(":To:", ":"));
    expect(dkimBoundTo(unsigned, address, before)).toBe(false);
  });
});

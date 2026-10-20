import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySignature } from "@/lib/mailgun";
import { isOverdue, isUnconfirmed, type FlagInput } from "@/lib/rules";

const cfg = { confirmHours: 6, overdueHours: 24, overdueHardHours: 96 };
const h = (hours: number) => new Date(Date.UTC(2026, 9, 23, 10) + hours * 3600_000);

const sent: FlagInput = {
  sentAt: h(0),
  confirmedAt: null,
  replicatedAt: null,
  revokedAt: null,
  unconfirmedFlaggedAt: null,
  overdueFlaggedAt: null,
  flagsClearedAt: null,
};

describe("isUnconfirmed", () => {
  it("flags after CONFIRM_HOURS without a reply", () => {
    expect(isUnconfirmed(sent, h(5), cfg)).toBe(false);
    expect(isUnconfirmed(sent, h(7), cfg)).toBe(true);
  });

  it("does not flag confirmed, revoked, unsent or already flagged assignments", () => {
    expect(isUnconfirmed({ ...sent, confirmedAt: h(1) }, h(7), cfg)).toBe(false);
    expect(isUnconfirmed({ ...sent, revokedAt: h(1) }, h(7), cfg)).toBe(false);
    expect(isUnconfirmed({ ...sent, sentAt: null }, h(7), cfg)).toBe(false);
    expect(isUnconfirmed({ ...sent, unconfirmedFlaggedAt: h(7) }, h(8), cfg)).toBe(false);
  });
});

describe("isOverdue", () => {
  it("waits for a bank run after the deadline", () => {
    // weekend: no replica arrived for anyone since the deadline
    expect(isOverdue(sent, h(60), h(20), cfg)).toBe(false);
    // a replica for someone else arrived after the deadline
    expect(isOverdue(sent, h(60), h(50), cfg)).toBe(true);
    // before the deadline nothing is overdue
    expect(isOverdue(sent, h(23), h(22), cfg)).toBe(false);
  });

  it("flags after the hard limit regardless", () => {
    expect(isOverdue(sent, h(97), null, cfg)).toBe(true);
  });

  it("does not flag replicated or revoked assignments", () => {
    expect(isOverdue({ ...sent, replicatedAt: h(30) }, h(97), h(50), cfg)).toBe(false);
    expect(isOverdue({ ...sent, revokedAt: h(1) }, h(97), h(50), cfg)).toBe(false);
  });
});

describe("clearing flags", () => {
  it("restarts the timers instead of flagging again right away", () => {
    const cleared = { ...sent, flagsClearedAt: h(8) };
    expect(isUnconfirmed(cleared, h(9), cfg)).toBe(false);
    expect(isUnconfirmed(cleared, h(15), cfg)).toBe(true);
    // the bank run at 30h was before the new deadline (8h + 24h)
    expect(isOverdue(sent, h(40), h(30), cfg)).toBe(true);
    expect(isOverdue(cleared, h(40), h(30), cfg)).toBe(false);
    expect(isOverdue(cleared, h(40), h(35), cfg)).toBe(true);
    expect(isOverdue(cleared, h(97), null, cfg)).toBe(false);
    expect(isOverdue(cleared, h(105), null, cfg)).toBe(true);
  });
});

describe("verifySignature", () => {
  const key = "key-test";
  const ts = "1761220000";
  const token = "abcdef0123456789";
  const sig = createHmac("sha256", key).update(ts + token).digest("hex");

  it("accepts the right signature only", () => {
    expect(verifySignature(key, ts, token, sig)).toBe(true);
    expect(verifySignature(key, ts, token, sig.replace(/.$/, "0"))).toBe(sig.endsWith("0"));
    expect(verifySignature("other", ts, token, sig)).toBe(false);
    expect(verifySignature("", ts, token, sig)).toBe(false);
    expect(verifySignature(key, ts, token, "")).toBe(false);
  });
});

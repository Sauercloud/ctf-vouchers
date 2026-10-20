const HOUR = 60 * 60 * 1000;

export interface FlagInput {
  sentAt: Date | null;
  confirmedAt: Date | null;
  replicatedAt: Date | null;
  revokedAt: Date | null;
  unconfirmedFlaggedAt: Date | null;
  overdueFlaggedAt: Date | null;
  // An admin cleared the flags: the timers restart from here.
  flagsClearedAt: Date | null;
}

export interface FlagConfig {
  confirmHours: number;
  overdueHours: number;
  overdueHardHours: number;
}

function since(a: FlagInput): number {
  return Math.max(a.sentAt!.getTime(), a.flagsClearedAt?.getTime() ?? 0);
}

// The team did not reply to the voucher mail in time.
export function isUnconfirmed(a: FlagInput, now: Date, cfg: FlagConfig): boolean {
  if (!a.sentAt || a.confirmedAt || a.revokedAt || a.unconfirmedFlaggedAt) return false;
  return now.getTime() > since(a) + cfg.confirmHours * HOUR;
}

// No replica arrived although the CCC processed payments after the deadline
// (some other replica arrived after it), or the hard limit passed. This keeps
// weekends without bank runs from flagging everyone.
export function isOverdue(
  a: FlagInput,
  now: Date,
  lastReplicaAt: Date | null,
  cfg: FlagConfig,
): boolean {
  if (!a.sentAt || a.replicatedAt || a.revokedAt || a.overdueFlaggedAt) return false;
  const deadline = since(a) + cfg.overdueHours * HOUR;
  if (now.getTime() > since(a) + cfg.overdueHardHours * HOUR) return true;
  return (
    now.getTime() > deadline &&
    lastReplicaAt !== null &&
    lastReplicaAt.getTime() > deadline
  );
}

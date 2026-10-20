import { createHash } from "node:crypto";
import { config } from "@/lib/config";
import { getState } from "@/lib/distribute";
import { roundCount, roundEntries, toOrderTeam } from "@/lib/order";
import { prisma } from "@/lib/prisma";

export interface TeamStats {
  allocated: number;
  sent: number;
  confirmed: number;
  replicated: number;
  flagged: number;
}

export interface RoundEntry {
  teamId: number;
  name: string;
  want: number;
  got: number;
  // "late": registered after the freeze, "extra": raised after the freeze.
  tag: "late" | "extra" | null;
}

const berlin = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

// "23 Oct, 10:00 CEST", the CCC announces everything in Hamburg time.
export const berlinTime = (date: Date) => berlin.format(date);

// SHA-256 of the shuffle seed. Published while registration is open, so it
// is visible that the seed revealed at the freeze was fixed in advance.
// SHUFFLE_SEED must therefore never change once the site is public.
export function seedHash(state: { frozenAt: Date | null; seed: string | null }): string | null {
  const seed = state.frozenAt ? state.seed : config.shuffleSeed;
  return seed ? createHash("sha256").update(seed).digest("hex") : null;
}

// Everything the public sequence page and the dashboard need. Never
// includes voucher codes.
export async function loadSequence() {
  const state = await getState(prisma);
  const teams = await prisma.team.findMany({ where: { registeredAt: { not: null } } });
  const assignments = await prisma.assignment.findMany({ where: { slotRefunded: false } });

  const stats = new Map<number, TeamStats>();
  for (const a of assignments) {
    const s = stats.get(a.teamId) ?? { allocated: 0, sent: 0, confirmed: 0, replicated: 0, flagged: 0 };
    s.allocated++;
    if (a.sentAt) s.sent++;
    if (a.confirmedAt) s.confirmed++;
    if (a.replicatedAt) s.replicated++;
    if ((a.unconfirmedFlaggedAt && !a.confirmedAt) || (a.overdueFlaggedAt && !a.replicatedAt)) {
      s.flagged++;
    }
    stats.set(a.teamId, s);
  }

  const perRound = config.perRound;
  const rounds: RoundEntry[][] = [];
  if (state.frozenAt && state.seed) {
    const frozen = new Set(state.frozenTeamIds);
    const byId = new Map(teams.map((t) => [t.id, t]));
    const orderTeams = teams.map((t) => toOrderTeam(t, frozen));
    for (let r = 0; r < roundCount(orderTeams, perRound); r++) {
      rounds.push(
        roundEntries(state.seed, r, state.frozenTeamIds, orderTeams, perRound)
          .filter((e) => !byId.get(e.teamId)!.banned)
          .map((e) => {
            const want = e.hi - e.lo;
            const got = Math.max(0, Math.min(want, (stats.get(e.teamId)?.allocated ?? 0) - e.lo));
            const tag = e.late ? (frozen.has(e.teamId) ? "extra" : "late") : null;
            return { teamId: e.teamId, name: byId.get(e.teamId)!.name, want, got, tag };
          }),
      );
    }
  }

  return {
    frozenAt: state.frozenAt,
    seed: state.frozenAt ? state.seed : null,
    seedHash: seedHash(state),
    // The shuffle input, banned teams included.
    frozenTeamIds: [...new Set(state.frozenTeamIds)].sort((a, b) => a - b),
    teams: teams
      .filter((t) => !t.banned)
      .map((t) => ({ id: t.id, name: t.name, requested: t.requested }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    rounds,
    stats,
  };
}

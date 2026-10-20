import seedrandom from "seedrandom";

// A request made after the freeze: the team's vouchers up to `upTo` (above
// the previous raise) queue at the back of every round from `at`. For late
// teams the first one is the registration.
export interface Raise {
  at: Date;
  upTo: number;
}

// Vouchers [lo, hi) of a team's total, queued at the back of every round.
export interface Tier {
  lo: number;
  hi: number;
  at: Date | null;
}

export interface OrderTeam {
  id: number;
  requested: number;
  banned: boolean;
  registeredAt: Date | null;
  // Vouchers that keep the team's shuffled place: its request at the freeze
  // (or less if it lowered since). 0 for teams registered after the freeze.
  onTime: number;
  // Everything above `onTime`, one tier per raise in time order.
  tiers: Tier[];
}

// A team's share of one round: the vouchers numbered [lo, hi) of its total.
export interface Entry {
  teamId: number;
  round: number;
  lo: number;
  hi: number;
  late: boolean;
}

export interface Slot {
  teamId: number;
  round: number;
}

// `Team.raises` as stored in the database.
export function parseRaises(json: unknown): Raise[] {
  if (!Array.isArray(json)) return [];
  return json.map((r: { at: string; upTo: number }) => ({ at: new Date(r.at), upTo: r.upTo }));
}

export function serializeRaises(raises: readonly Raise[]) {
  return raises.map((r) => ({ at: r.at.toISOString(), upTo: r.upTo }));
}

// The raises after a team changed its request to `requested` at `now`.
// `base` is the request that keeps the shuffled place (0 for late teams).
// Lowering cuts the latest raises first, a raise queues only the new
// vouchers, so earlier raises keep their place.
export function updateRaises(
  raises: readonly Raise[],
  base: number,
  requested: number,
  now: Date,
): Raise[] {
  const next: Raise[] = [];
  let top = base;
  for (const r of raises) {
    const upTo = Math.min(r.upTo, requested);
    if (upTo > top) next.push({ at: r.at, upTo });
    top = Math.max(top, upTo);
  }
  if (requested > top) next.push({ at: now, upTo: requested });
  return next;
}

export function toOrderTeam(
  team: {
    id: number;
    requested: number;
    banned: boolean;
    registeredAt: Date | null;
    frozenRequested: number | null;
    raises: unknown;
  },
  frozenTeamIds: ReadonlySet<number>,
): OrderTeam {
  const frozen = frozenTeamIds.has(team.id);
  const onTime = frozen ? Math.min(team.frozenRequested ?? team.requested, team.requested) : 0;
  const tiers: Tier[] = [];
  let lo = onTime;
  for (const r of parseRaises(team.raises)) {
    const hi = Math.min(r.upTo, team.requested);
    if (hi > lo) tiers.push({ lo, hi, at: r.at });
    lo = Math.max(lo, hi);
  }
  // Not covered by a raise (should not happen): late teams queue by
  // registration, frozen teams at the very end.
  if (team.requested > lo) {
    tiers.push({ lo, hi: team.requested, at: frozen ? null : team.registeredAt });
  }
  return {
    id: team.id,
    requested: team.requested,
    banned: team.banned,
    registeredAt: team.registeredAt,
    onTime,
    tiers,
  };
}

export function shuffle<T>(rng: () => number, input: readonly T[]): T[] {
  const array = [...input];
  for (let m = array.length; m > 1; ) {
    const i = Math.floor(rng() * m--);
    [array[m], array[i]] = [array[i], array[m]];
  }
  return array;
}

// All shares of a round, in the order they are served. First the frozen
// teams in shuffled order for their on-time vouchers, then the back-of-round
// queue (late registrations and raises) by time. The shuffle input is the
// frozen snapshot only and every round gets its own RNG, so later changes
// never move any other team.
export function roundEntries(
  seed: string,
  round: number,
  frozenTeamIds: readonly number[],
  teams: readonly OrderTeam[],
  perRound: number,
): Entry[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const sortedFrozen = [...new Set(frozenTeamIds)].sort((a, b) => a - b);
  const start = perRound * round;
  const end = perRound * (round + 1);
  const entries: Entry[] = [];

  for (const id of shuffle(seedrandom(`${seed}:${round}`), sortedFrozen)) {
    const t = byId.get(id);
    if (!t) continue;
    const cap = Math.min(t.onTime, t.requested);
    const lo = Math.min(cap, start);
    const hi = Math.min(cap, end);
    if (hi > lo) entries.push({ teamId: id, round, lo, hi, late: false });
  }

  const late = teams
    .filter((t) => t.registeredAt !== null)
    .flatMap((t) => t.tiers.map((tier) => ({ teamId: t.id, ...tier })))
    .sort(
      (a, b) =>
        (a.at?.getTime() ?? Infinity) - (b.at?.getTime() ?? Infinity) ||
        a.teamId - b.teamId ||
        a.lo - b.lo,
    );
  for (const t of late) {
    const lo = Math.max(t.lo, start);
    const hi = Math.min(t.hi, end);
    if (hi > lo) entries.push({ teamId: t.teamId, round, lo, hi, late: true });
  }

  return entries;
}

export function roundCount(teams: readonly OrderTeam[], perRound: number) {
  const max = Math.max(0, ...teams.map((t) => t.requested));
  return Math.ceil(max / perRound);
}

// The slots the next vouchers go to, until every request is satisfied. The
// caller must count each slot in `allocated` before taking the next one;
// since counts only grow, the walk never has to restart from round 0.
export function* slots(
  seed: string,
  frozenTeamIds: readonly number[],
  teams: readonly OrderTeam[],
  allocated: ReadonlyMap<number, number>,
  perRound: number,
): Generator<Slot> {
  const banned = new Set(teams.filter((t) => t.banned).map((t) => t.id));
  const rounds = roundCount(teams, perRound);
  for (let round = 0; round < rounds; round++) {
    for (const e of roundEntries(seed, round, frozenTeamIds, teams, perRound)) {
      if (banned.has(e.teamId)) continue;
      while ((allocated.get(e.teamId) ?? 0) < e.hi) yield { teamId: e.teamId, round };
    }
  }
}

// The slot the next voucher goes to, or null if every request is satisfied.
export function nextSlot(
  seed: string,
  frozenTeamIds: readonly number[],
  teams: readonly OrderTeam[],
  allocated: ReadonlyMap<number, number>,
  perRound: number,
): Slot | null {
  const next = slots(seed, frozenTeamIds, teams, allocated, perRound).next();
  return next.done ? null : next.value;
}

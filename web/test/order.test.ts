import seedrandom from "seedrandom";
import { describe, expect, it } from "vitest";
import {
  nextSlot,
  roundEntries,
  serializeRaises,
  slots as slotIter,
  toOrderTeam,
  updateRaises,
  type Raise,
  type Slot,
} from "@/lib/order";

const SEED = "test-seed";
const day = (d: number) => new Date(Date.UTC(2026, 9, d));

interface TeamRow {
  id: number;
  requested: number;
  banned: boolean;
  registeredAt: Date | null;
  frozenRequested: number | null;
  raises: Raise[];
}

// A team registered before the freeze, with its request frozen as given.
function team(id: number, requested: number, extra: Partial<TeamRow> = {}): TeamRow {
  return {
    id,
    requested,
    banned: false,
    registeredAt: day(20),
    frozenRequested: requested,
    raises: [],
    ...extra,
  };
}

const late = (id: number, requested: number, at: Date) =>
  team(id, requested, { registeredAt: at, frozenRequested: null, raises: [{ at, upTo: requested }] });

// Changes the request after the freeze, like saveRegistration does.
const raised = (t: TeamRow, requested: number, at: Date): TeamRow => ({
  ...t,
  requested,
  raises: updateRaises(t.raises, t.frozenRequested ?? 0, requested, at),
});

const orderTeams = (rows: TeamRow[], frozen: number[]) =>
  rows.map((t) => toOrderTeam({ ...t, raises: serializeRaises(t.raises) }, new Set(frozen)));

const frozenIds = (rows: TeamRow[]) => rows.filter((t) => t.frozenRequested !== null).map((t) => t.id);

// Hands out `n` vouchers one after another, like distribute() does.
function run(rows: TeamRow[], frozen: number[], n: number, perRound = 2): Slot[] {
  const teams = orderTeams(rows, frozen);
  const allocated = new Map<number, number>();
  const slots: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const slot = nextSlot(SEED, frozen, teams, allocated, perRound);
    if (!slot) break;
    slots.push(slot);
    allocated.set(slot.teamId, (allocated.get(slot.teamId) ?? 0) + 1);
  }
  return slots;
}

function order(rows: TeamRow[], frozen: number[], round: number, seed = SEED) {
  const teams = orderTeams(rows, frozen);
  return roundEntries(seed, round, frozen, teams, 2).map((e) => e.teamId);
}

const perTeamRound = (slots: Slot[], id: number, round: number) =>
  slots.filter((s) => s.teamId === id && s.round === round).length;

describe("roundEntries", () => {
  const teams = Array.from({ length: 20 }, (_, i) => team(1000 + i * 7, 4));
  const frozen = frozenIds(teams);

  it("is deterministic and a permutation", () => {
    const a = order(teams, frozen, 0);
    expect(a).toEqual(order(teams, frozen, 0));
    expect([...a].sort()).toEqual([...frozen].sort());
  });

  it("does not depend on the order teams are passed in", () => {
    expect(order([...teams].reverse(), [...frozen].reverse(), 1)).toEqual(order(teams, frozen, 1));
  });

  it("shuffles each round independently", () => {
    expect(order(teams, frozen, 0)).not.toEqual(order(teams, frozen, 1));
    expect(order(teams, frozen, 0)).not.toEqual(order(teams, frozen, 0, "other"));
  });

  it("appends late teams by registration time without moving anyone", () => {
    const before = order(teams, frozen, 0);
    const after = order([...teams, late(5, 2, day(25)), late(3, 2, day(24))], frozen, 0);
    expect(after).toEqual([...before, 3, 5]);
  });

  it("lists a raised team twice when its extra vouchers start inside a round", () => {
    const rows = [raised(team(1, 1), 4, day(25)), team(2, 2)];
    const teams = orderTeams(rows, [1, 2]);
    const r0 = roundEntries(SEED, 0, [1, 2], teams, 2);
    expect(r0.filter((e) => e.teamId === 1)).toEqual([
      { teamId: 1, round: 0, lo: 0, hi: 1, late: false },
      { teamId: 1, round: 0, lo: 1, hi: 2, late: true },
    ]);
    expect(r0.at(-1)?.teamId).toBe(1);
  });
});

describe("nextSlot", () => {
  it("gives up to 2 per round until the request is met", () => {
    const teams = [team(1, 1), team(2, 3), team(3, 5)];
    const slots = run(teams, [1, 2, 3], 100);
    expect(slots).toHaveLength(9);
    expect([1, 2, 3].map((id) => perTeamRound(slots, id, 0))).toEqual([1, 2, 2]);
    expect([2, 3].map((id) => perTeamRound(slots, id, 1))).toEqual([1, 2]);
    expect(perTeamRound(slots, 3, 2)).toBe(1);
    // rounds are handed out in order
    expect(slots.map((s) => s.round)).toEqual([...slots.map((s) => s.round)].sort());
  });

  it("gives a team its two vouchers of a round back to back", () => {
    const teams = Array.from({ length: 10 }, (_, i) => team(i + 1, 2));
    const slots = run(teams, frozenIds(teams), 20);
    for (let i = 0; i < slots.length; i += 2) {
      expect(slots[i].teamId).toBe(slots[i + 1].teamId);
    }
  });

  it("skips banned and unregistered teams", () => {
    const teams = [team(1, 2, { banned: true }), team(2, 2), team(3, 2, { registeredAt: null, frozenRequested: null })];
    expect(new Set(run(teams, [1, 2], 10).map((s) => s.teamId))).toEqual(new Set([2]));
  });

  // Regression for last year: changes to some teams reshuffled everyone.
  it("keeps everyone else's order when teams are banned, lower, raise or join late", () => {
    const teams = Array.from({ length: 30 }, (_, i) => team(100 + i, 2 + (i % 5)));
    const frozen = frozenIds(teams);
    const base = run(teams, frozen, 1000);

    const changed = teams.map((t) =>
      t.id === 105
        ? { ...t, banned: true }
        : t.id === 117
          ? { ...t, requested: 1, frozenRequested: 1 }
          : t.id === 121
            ? raised(t, 10, day(25))
            : t,
    );
    changed.push(late(999, 3, day(26)));
    const after = run(changed, frozen, 1000);

    const untouched = (s: Slot) => ![105, 117, 121, 999].includes(s.teamId);
    expect(after.filter(untouched)).toEqual(base.filter(untouched));
  });

  it("puts a late team after all on-time teams of each round", () => {
    const teams = [team(1, 4), team(2, 4), late(3, 4, day(27))];
    const slots = run(teams, [1, 2], 100);
    const round0 = slots.filter((s) => s.round === 0).map((s) => s.teamId);
    expect(round0.slice(-2)).toEqual([3, 3]);
  });

  it("keeps a raised team's frozen vouchers in place and queues the extra ones at the back", () => {
    const base = [team(1, 2), team(2, 2), team(3, 2), team(4, 2)];
    const frozen = frozenIds(base);
    const before = run(base, frozen, 100);
    const rows = base.map((t) => (t.id === 2 ? raised(t, 4, day(25)) : t));
    const after = run(rows, frozen, 100);

    // round 1 is unchanged, team 2 still gets its 2 frozen vouchers at its place
    expect(after.filter((s) => s.round === 0)).toEqual(before);
    // the 2 extra ones come in round 2, which only exists because of the raise
    expect(after.filter((s) => s.round === 1)).toEqual([
      { teamId: 2, round: 1 },
      { teamId: 2, round: 1 },
    ]);
  });

  it("orders extra vouchers and late teams by time", () => {
    const rows = [
      raised(team(1, 2), 4, day(26)),
      raised(team(2, 2), 4, day(24)),
      late(3, 4, day(25)),
      team(4, 4),
    ];
    const slots = run(rows, [1, 2, 4], 100);
    const round1 = slots.filter((s) => s.round === 1).map((s) => s.teamId);
    // frozen team 4 first, then by time: team 2 (raised 24th), team 3 (registered 25th), team 1 (raised 26th)
    expect(round1).toEqual([4, 4, 2, 2, 3, 3, 1, 1]);
  });

  it("serves a raise inside the current round at the end of that round", () => {
    // frozen with 1, raised to 3: the 2nd voucher comes at the end of round 1
    const rows = [raised(team(1, 1), 3, day(25)), team(2, 2), team(3, 2)];
    const slots = run(rows, [1, 2, 3], 100);
    const round0 = slots.filter((s) => s.round === 0).map((s) => s.teamId);
    expect(round0.at(-1)).toBe(1);
    expect(perTeamRound(slots, 1, 0)).toBe(2);
    expect(perTeamRound(slots, 1, 1)).toBe(1);
  });

  it("keeps an earlier raise in place when the team raises again", () => {
    // team 1 raises 2 -> 3 on the 24th, team 2 raises 2 -> 4 on the 25th,
    // team 1 raises 3 -> 4 on the 26th: only its 4th voucher goes behind team 2
    let t1 = raised(team(1, 2), 3, day(24));
    const t2 = raised(team(2, 2), 4, day(25));
    t1 = raised(t1, 4, day(26));
    const slots = run([t1, t2], [1, 2], 100);
    const round1 = slots.filter((s) => s.round === 1).map((s) => s.teamId);
    expect(round1).toEqual([1, 2, 2, 1]);
  });

  it("cuts the latest raise first and queues a raise after lowering anew", () => {
    let t = raised(team(1, 2), 4, day(24));
    t = raised(t, 3, day(25));
    expect(t.raises).toEqual([{ at: day(24), upTo: 3 }]);
    t = raised(t, 5, day(26));
    expect(t.raises).toEqual([
      { at: day(24), upTo: 3 },
      { at: day(26), upTo: 5 },
    ]);
    // lowering below the frozen request drops every raise
    expect(updateRaises(t.raises, 1, 1, day(27))).toEqual([]);
  });

  it("walks the slots in one pass like repeated nextSlot calls", () => {
    const rows = [
      ...Array.from({ length: 15 }, (_, i) => team(10 + i, 1 + (i % 6))),
      raised(team(1, 2), 5, day(24)),
      late(2, 3, day(25)),
    ];
    const frozen = frozenIds(rows).filter((id) => id !== 2);
    const allocated = new Map<number, number>();
    const walked: Slot[] = [];
    for (const slot of slotIter(SEED, frozen, orderTeams(rows, frozen), allocated, 2)) {
      walked.push(slot);
      allocated.set(slot.teamId, (allocated.get(slot.teamId) ?? 0) + 1);
    }
    expect(walked).toEqual(run(rows, frozen, 1000));
  });
});

// The algorithm as published on /sequence, implemented independently.
describe("published verification instructions", () => {
  it("match the order, with round n using the seed suffix n-1", () => {
    const teams = Array.from({ length: 25 }, (_, i) => team(3000 - i * 11, 6));
    const frozen = frozenIds(teams);
    for (let n = 1; n <= 3; n++) {
      const rng = seedrandom(`${SEED}:${n - 1}`);
      const a = [...frozen].sort((x, y) => x - y);
      for (let i = a.length - 1; i >= 1; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      expect(order(teams, frozen, n - 1)).toEqual(a);
    }
  });
});

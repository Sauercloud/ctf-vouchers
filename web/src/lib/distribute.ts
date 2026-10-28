import { newToken } from "@/lib/addresses";
import { config } from "@/lib/config";
import { voucherMail } from "@/lib/mail-templates";
import { slots, toOrderTeam } from "@/lib/order";
import type { Tx } from "@/lib/prisma";

// Serializes everything that changes vouchers or assignments.
export async function lock(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(40403)`;
}

export async function getState(tx: Tx) {
  return tx.state.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export async function freeze(tx: Tx) {
  const state = await getState(tx);
  if (state.frozenAt) return state;
  if (!config.shuffleSeed) throw new Error("SHUFFLE_SEED is not set");
  const teams = await tx.team.findMany({
    where: { registeredAt: { not: null } },
    select: { id: true },
  });
  await tx.$executeRaw`UPDATE "Team" SET "frozenRequested" = "requested" WHERE "registeredAt" IS NOT NULL`;
  return tx.state.update({
    where: { id: 1 },
    data: {
      frozenAt: new Date(),
      frozenTeamIds: teams.map((t) => t.id),
      seed: config.shuffleSeed,
    },
  });
}

// Counts assignments per team, except revocations that refunded the slot.
export async function allocatedCounts(tx: Tx) {
  const rows = await tx.assignment.groupBy({
    by: ["teamId"],
    where: { slotRefunded: false },
    _count: true,
  });
  return new Map(rows.map((r) => [r.teamId, r._count]));
}

// Hands every free voucher to the next slot and queues the mail. Must run
// inside a transaction holding `lock`. Does nothing while paused.
export async function distribute(tx: Tx): Promise<number> {
  const state = await getState(tx);
  if (!state.frozenAt || !state.seed || state.pausedAt) return 0;

  const vouchers = await tx.voucher.findMany({
    where: { held: false, assignments: { none: { revokedAt: null } } },
    orderBy: { createdAt: "asc" },
  });
  if (vouchers.length === 0) return 0;

  const rows = await tx.team.findMany();
  const byId = new Map(rows.map((t) => [t.id, t]));
  const frozen = new Set(state.frozenTeamIds);
  const teams = rows.map((t) => toOrderTeam(t, frozen));
  const allocated = await allocatedCounts(tx);

  const next = slots(state.seed, state.frozenTeamIds, teams, allocated, config.perRound);
  let assigned = 0;
  for (const voucher of vouchers) {
    const { value: slot, done } = next.next();
    if (done) break;
    const team = byId.get(slot.teamId)!;
    const token = newToken();
    const mail = voucherMail(team.name, voucher.code, token);
    await tx.assignment.create({
      data: {
        token,
        round: slot.round,
        voucherId: voucher.id,
        teamId: team.id,
        outbound: {
          create: {
            kind: "VOUCHER",
            to: team.contactEmail!,
            replyTo: mail.replyTo,
            subject: mail.subject,
            text: mail.text,
          },
        },
      },
    });
    allocated.set(team.id, (allocated.get(team.id) ?? 0) + 1);
    assigned++;
  }
  return assigned;
}

// Stops a voucher mail that has not gone out yet, before its assignment is
// revoked. Returns an error while the mail is being sent.
export async function cancelPendingMails(tx: Tx, assignmentId: string): Promise<string | void> {
  const sending = await tx.outboundMail.count({ where: { assignmentId, status: "SENDING" } });
  if (sending) return "the voucher mail is being sent right now, try again in a minute";
  await tx.outboundMail.updateMany({
    where: { assignmentId, status: "PENDING" },
    data: { status: "CANCELLED", lastError: "assignment revoked before sending" },
  });
}

export async function queueAdminAlert(tx: Tx, subject: string, text: string) {
  if (!config.adminEmail) return;
  await tx.outboundMail.create({
    data: { kind: "ADMIN_ALERT", to: config.adminEmail, subject, text },
  });
}

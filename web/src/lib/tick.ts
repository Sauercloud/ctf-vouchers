import { config } from "@/lib/config";
import { distribute, getState, lock, queueAdminAlert } from "@/lib/distribute";
import { MailgunError, sendMail } from "@/lib/mailgun";
import { prisma, type Tx } from "@/lib/prisma";
import { isOverdue, isUnconfirmed } from "@/lib/rules";

const MAX_ATTEMPTS = 5;

// Periodic work, triggered by the systemd timer.
export async function tick(now = new Date()) {
  const { assigned, flagged } = await prisma.$transaction(async (tx) => {
    await lock(tx);
    const assigned = await distribute(tx);
    const flagged = await flagAssignments(tx, now);
    return { assigned, flagged };
  });
  const sent = await sendOutbox(now);
  return { assigned, flagged, ...sent };
}

async function flagAssignments(tx: Tx, now: Date) {
  const cfg = {
    confirmHours: config.confirmHours,
    overdueHours: config.overdueHours,
    overdueHardHours: config.overdueHardHours,
  };
  const lastReplica = await tx.voucher.findFirst({
    where: { source: "REPLICATED", held: false },
    orderBy: { createdAt: "desc" },
  });
  const open = await tx.assignment.findMany({
    where: {
      sentAt: { not: null },
      revokedAt: null,
      OR: [{ confirmedAt: null }, { replicatedAt: null }],
    },
    include: { team: true },
  });

  const lines: string[] = [];
  for (const a of open) {
    if (isUnconfirmed(a, now, cfg)) {
      await tx.assignment.update({ where: { id: a.id }, data: { unconfirmedFlaggedAt: now } });
      lines.push(`${a.team.name}: no confirmation ${cfg.confirmHours}h after sending (round ${a.round + 1})`);
    }
    if (isOverdue(a, now, lastReplica?.createdAt ?? null, cfg)) {
      await tx.assignment.update({ where: { id: a.id }, data: { overdueFlaggedAt: now } });
      lines.push(`${a.team.name}: no replicated voucher (round ${a.round + 1}, sent ${a.sentAt!.toISOString()})`);
    }
  }
  if (lines.length) {
    await queueAdminAlert(
      tx,
      `[ctf-vouchers] ${lines.length} voucher(s) flagged`,
      `${lines.map((l) => `- ${l}`).join("\n")}\n\n${config.baseUrl}/admin\n`,
    );
  }
  return lines.length;
}

function startOfUtcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// A claim older than this belongs to a send that crashed or hung.
const STALE_CLAIM_MS = 10 * 60 * 1000;

export async function sendOutbox(now = new Date()) {
  await failStaleClaims(now);

  const sentToday = await prisma.outboundMail.count({
    where: { sentAt: { gte: startOfUtcDay(now) } },
  });
  let budget = config.dailySendLimit - sentToday;
  if (budget <= 0) return { sent: 0, deferred: true };

  // While paused only admin alerts go out.
  const paused = async () => !!(await getState(prisma)).pausedAt;

  // Voucher mails first (enum order), oldest first.
  const pending = await prisma.outboundMail.findMany({
    where: { status: "PENDING", ...((await paused()) && { kind: "ADMIN_ALERT" }) },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    take: budget,
  });

  let sent = 0;
  for (const mail of pending) {
    // Pausing during a run stops it before the next voucher mail.
    if (mail.kind === "VOUCHER" && (await paused())) continue;
    // Claim the row so overlapping ticks never send twice. Mails of revoked
    // assignments are never sent.
    const claim = await prisma.outboundMail.updateMany({
      where: {
        id: mail.id,
        status: "PENDING",
        OR: [{ assignmentId: null }, { assignment: { is: { revokedAt: null } } }],
      },
      data: { status: "SENDING", claimedAt: new Date() },
    });
    if (claim.count !== 1) continue;

    let mailgunId: string;
    try {
      mailgunId = await sendMail(mail);
    } catch (e) {
      // Quota or auth problems affect every mail and are not the mail's
      // fault: keep it pending without using up an attempt and stop.
      if (e instanceof MailgunError && [401, 403, 429].includes(e.status)) {
        await prisma.outboundMail.update({
          where: { id: mail.id },
          data: { status: "PENDING", lastError: String(e) },
        });
        break;
      }
      // After a timeout Mailgun may have accepted the mail, don't resend it.
      const timeout = e instanceof Error && e.name === "TimeoutError";
      const attempts = mail.attempts + 1;
      const failed = timeout || attempts >= MAX_ATTEMPTS;
      await prisma.outboundMail.update({
        where: { id: mail.id },
        data: {
          status: failed ? "FAILED" : "PENDING",
          attempts,
          lastError: timeout ? `${String(e)}, check the Mailgun logs before retrying` : String(e),
        },
      });
      if (failed && mail.kind === "VOUCHER") {
        await queueAdminAlert(
          prisma,
          `[ctf-vouchers] voucher mail to ${mail.to} failed`,
          `${String(e)}\n\n${config.baseUrl}/admin/outbox\n`,
        );
      }
      continue;
    }

    // Mailgun accepted the mail. If this fails the row stays SENDING and is
    // flagged by failStaleClaims, never sent again automatically.
    const sentAt = new Date();
    await prisma.$transaction([
      prisma.outboundMail.update({
        where: { id: mail.id },
        data: { status: "SENT", sentAt, mailgunId, attempts: mail.attempts + 1, lastError: null },
      }),
      ...(mail.assignmentId
        ? [
            prisma.assignment.updateMany({
              where: { id: mail.assignmentId, sentAt: null },
              data: { sentAt },
            }),
          ]
        : []),
    ]);
    sent++;
    budget--;
    if (budget <= 0) break;
  }
  return { sent, deferred: budget <= 0 };
}

// Mails stuck in SENDING may or may not have reached Mailgun. Resending could
// deliver a voucher twice, so they fail and an admin checks the Mailgun logs.
async function failStaleClaims(now: Date) {
  const stale = await prisma.outboundMail.findMany({
    where: {
      status: "SENDING",
      OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } }],
    },
  });
  for (const mail of stale) {
    const claim = await prisma.outboundMail.updateMany({
      where: { id: mail.id, status: "SENDING", claimedAt: mail.claimedAt },
      data: {
        status: "FAILED",
        lastError: "interrupted while sending, check the Mailgun logs before retrying",
      },
    });
    if (claim.count === 1 && mail.kind === "VOUCHER") {
      await queueAdminAlert(
        prisma,
        `[ctf-vouchers] voucher mail to ${mail.to} interrupted`,
        `The mail may or may not have been sent, check the Mailgun logs.\n\n${config.baseUrl}/admin/outbox\n`,
      );
    }
  }
}

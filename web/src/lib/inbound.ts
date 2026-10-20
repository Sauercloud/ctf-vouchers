import { replicaAddress } from "@/lib/addresses";
import { config } from "@/lib/config";
import { distribute, freeze, lock, queueAdminAlert } from "@/lib/distribute";
import type { InboundStatus } from "@/generated/prisma/client";
import {
  addressAllowed,
  bareAddress,
  classifyRecipient,
  dkimBoundTo,
  dkimTrusted,
  extractCodes,
  isAutoReply,
  type Headers,
} from "@/lib/parse";
import type { Tx } from "@/lib/prisma";

export interface InboundInput {
  messageId: string;
  recipient: string;
  sender: string;
  from: string;
  subject: string;
  bodyPlain: string;
  headers: Headers;
}

interface Result {
  status: InboundStatus;
  note?: string;
  alert?: string;
}

// Handles one mail forwarded by Mailgun. Idempotent per Message-Id.
export async function processInbound(tx: Tx, input: InboundInput) {
  await lock(tx);
  if (await tx.inboundMail.findUnique({ where: { messageId: input.messageId } })) {
    return { status: "DUPLICATE" as const };
  }

  const mail = await tx.inboundMail.create({
    data: {
      messageId: input.messageId,
      recipient: input.recipient,
      sender: input.sender,
      from: input.from,
      subject: input.subject,
      bodyPlain: input.bodyPlain,
      headers: input.headers,
      status: "UNMATCHED",
    },
  });

  const results: Result[] = [];
  for (const address of input.recipient.split(",")) {
    const r = classifyRecipient(address, config.mailDomain, config.seedSecret);
    if (r.kind === "seed") results.push(await handleSeed(tx, mail.id, input));
    if (r.kind === "replica") results.push(await handleReplica(tx, mail.id, r.token, input));
    if (r.kind === "confirm") results.push(await handleConfirm(tx, r.token, input));
  }

  const status =
    results.find((r) => r.status !== "PROCESSED")?.status ??
    (results.length ? "PROCESSED" : "UNMATCHED");
  const note = results.map((r) => r.note).filter(Boolean).join("; ") || null;
  await tx.inboundMail.update({ where: { id: mail.id }, data: { status, note } });

  const alerts = results.map((r) => r.alert).filter((a): a is string => !!a);
  if (alerts.length) {
    await queueAdminAlert(
      tx,
      `[ctf-vouchers] inbound mail needs attention`,
      `${alerts.join("\n")}\n\nFrom: ${input.from}\nSubject: ${input.subject}\n${config.baseUrl}/admin/inbound\n`,
    );
  }

  const assigned = await distribute(tx);
  return { status, note, assigned };
}

async function createVouchers(
  tx: Tx,
  codes: string[],
  data: { source: "SEED" | "REPLICATED"; inboundMailId: string; parentAssignmentId?: string; held?: boolean; heldReason?: string },
) {
  let created = 0;
  for (const code of codes) {
    if (await tx.voucher.findUnique({ where: { code } })) continue;
    await tx.voucher.create({ data: { code, ...data } });
    created++;
  }
  return created;
}

async function handleSeed(tx: Tx, mailId: string, input: InboundInput): Promise<Result> {
  const allow = config.adminSenderAllowlist;
  if (allow.length && !addressAllowed(input.from, allow)) {
    return { status: "REJECTED", note: `seed mail from non-admin ${bareAddress(input.from)}` };
  }
  const codes = extractCodes(input.bodyPlain, config.voucherCodeRegex);
  if (codes.length === 0) {
    return { status: "NO_CODE", note: "seed mail without codes", alert: "Seed mail without voucher codes" };
  }
  const created = await createVouchers(tx, codes, { source: "SEED", inboundMailId: mailId });
  const state = await freeze(tx);
  return { status: "PROCESSED", note: `${created} seed voucher(s), frozen at ${state.frozenAt?.toISOString()}` };
}

async function handleReplica(tx: Tx, mailId: string, token: string, input: InboundInput): Promise<Result> {
  const assignment = await tx.assignment.findUnique({ where: { token }, include: { team: true } });
  if (!assignment) return { status: "UNMATCHED", note: "unknown replica token" };

  const codes = extractCodes(input.bodyPlain, config.voucherCodeRegex);
  if (codes.length === 0) {
    return {
      status: "NO_CODE",
      note: `replica mail for ${assignment.team.name} without code`,
      alert: `Replica mail for ${assignment.team.name} without a voucher code, enter it manually`,
    };
  }

  const ccc = config.cccSenderAllowlist;
  const trusted =
    addressAllowed(input.from, ccc) &&
    (!config.requireDkim ||
      (dkimTrusted(input.headers, ccc) &&
        dkimBoundTo(input.headers, replicaAddress(token), assignment.createdAt)));
  const heldReason = trusted
    ? undefined
    : `untrusted sender ${bareAddress(input.from)}, DKIM failed or not addressed to ${replicaAddress(token)}`;
  const created = await createVouchers(tx, codes, {
    source: "REPLICATED",
    inboundMailId: mailId,
    parentAssignmentId: assignment.id,
    held: !trusted,
    heldReason,
  });

  // Known codes are no proof the team passed its voucher on.
  if (trusted && created === 0) {
    return {
      status: "HELD",
      note: `replica mail for ${assignment.team.name} only has known codes`,
      alert: `Replica mail for ${assignment.team.name} only contains already known codes, check it`,
    };
  }
  if (!trusted) {
    return {
      status: "HELD",
      note: `${created} replica(s) from ${assignment.team.name} held: ${heldReason}`,
      alert: `Replica for ${assignment.team.name} held (${heldReason}), release it manually`,
    };
  }
  const now = new Date();
  await tx.assignment.update({
    where: { id: assignment.id },
    data: { replicatedAt: assignment.replicatedAt ?? now, confirmedAt: assignment.confirmedAt ?? now },
  });
  return { status: "PROCESSED", note: `${created} replica(s) from ${assignment.team.name}` };
}

async function handleConfirm(tx: Tx, token: string, input: InboundInput): Promise<Result> {
  const assignment = await tx.assignment.findUnique({ where: { token }, include: { team: true } });
  if (!assignment) return { status: "UNMATCHED", note: "unknown confirmation token" };
  if (isAutoReply(input.headers)) {
    return { status: "IGNORED", note: `auto-reply for ${assignment.team.name}` };
  }
  if (!assignment.confirmedAt) {
    const from = bareAddress(input.from);
    const fromTeam = from === assignment.team.contactEmail?.toLowerCase();
    await tx.assignment.update({
      where: { id: assignment.id },
      data: {
        confirmedAt: new Date(),
        confirmNote: fromTeam ? null : `confirmed by ${from}`,
      },
    });
  }
  return { status: "PROCESSED", note: `confirmation from ${assignment.team.name}` };
}

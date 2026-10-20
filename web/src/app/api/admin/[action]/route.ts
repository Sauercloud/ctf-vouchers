import { adminUser, sameOrigin } from "@/lib/admin";
import { config } from "@/lib/config";
import { cancelPendingMails, distribute, freeze, lock } from "@/lib/distribute";
import { voucherMail } from "@/lib/mail-templates";
import { extractCodes } from "@/lib/parse";
import { prisma, type Tx } from "@/lib/prisma";
import { tick } from "@/lib/tick";

// All admin mutations go through here (plain HTML form posts). Server actions
// are deliberately not used: they can be invoked via any path, which would
// bypass the nginx basic auth on /admin and /api/admin.

type Handler = (tx: Tx, f: (name: string) => string) => Promise<string | void>;

const handlers: Record<string, Handler> = {
  async freeze(tx) {
    await freeze(tx);
  },

  async "team-ban"(tx, f) {
    const id = Number(f("id"));
    if (!Number.isInteger(id) || id <= 0) return "invalid team id";
    await tx.team.upsert({
      where: { id },
      update: { banned: true, banReason: f("reason") || null },
      create: { id, name: f("name") || `team ${id}`, banned: true, banReason: f("reason") || null },
    });
  },

  async "team-unban"(tx, f) {
    await tx.team.update({ where: { id: Number(f("id")) }, data: { banned: false, banReason: null } });
  },

  async "vouchers-add"(tx, f) {
    const text = f("codes");
    const codes = extractCodes(text, config.voucherCodeRegex);
    if (codes.length === 0) return "no voucher codes found, check VOUCHER_CODE_REGEX";
    for (const code of codes) {
      if (await tx.voucher.findUnique({ where: { code } })) continue;
      await tx.voucher.create({ data: { code, source: "MANUAL" } });
    }
  },

  async "voucher-release"(tx, f) {
    const v = await tx.voucher.update({
      where: { id: f("id") },
      data: { held: false, heldReason: null },
    });
    if (v.parentAssignmentId) await markReplicated(tx, v.parentAssignmentId);
  },

  async "voucher-hold"(tx, f) {
    await tx.voucher.update({
      where: { id: f("id") },
      data: { held: true, heldReason: f("reason") || "held by admin" },
    });
  },

  async "assignment-confirm"(tx, f) {
    await tx.assignment.update({
      where: { id: f("id") },
      data: { confirmedAt: new Date(), confirmNote: "confirmed by admin" },
    });
  },

  async "assignment-revoke"(tx, f) {
    const err = await cancelPendingMails(tx, f("id"));
    if (err) return err;
    const a = await tx.assignment.update({
      where: { id: f("id") },
      data: {
        revokedAt: new Date(),
        revokeReason: f("reason") || "revoked by admin",
        slotRefunded: f("refund") === "on",
      },
    });
    // Without "hold" the voucher goes to the next team right away.
    if (f("hold") === "on") {
      await tx.voucher.update({
        where: { id: a.voucherId },
        data: { held: true, heldReason: "held after revocation" },
      });
    }
  },

  async "assignment-resend"(tx, f) {
    const a = await tx.assignment.findUniqueOrThrow({
      where: { id: f("id") },
      include: { team: true, voucher: true },
    });
    if (a.revokedAt) return "assignment is revoked";
    const mail = voucherMail(a.team.name, a.voucher.code, a.token);
    await tx.outboundMail.create({
      data: {
        kind: "VOUCHER",
        to: a.team.contactEmail!,
        replyTo: mail.replyTo,
        subject: mail.subject,
        text: mail.text,
        assignmentId: a.id,
      },
    });
  },

  // Snoozes the flags: the timers restart now.
  async "assignment-clear-flags"(tx, f) {
    await tx.assignment.update({
      where: { id: f("id") },
      data: { unconfirmedFlaggedAt: null, overdueFlaggedAt: null, flagsClearedAt: new Date() },
    });
  },

  // Code entered by hand for an inbound mail that could not be parsed.
  async "inbound-code"(tx, f) {
    const code = f("code").trim();
    if (!code) return "empty code";
    if (await tx.voucher.findUnique({ where: { code } })) return "code already known";
    const token = f("token").trim();
    const parent = token ? await tx.assignment.findUnique({ where: { token } }) : null;
    if (token && !parent) return "unknown token";
    await tx.voucher.create({
      data: {
        code,
        source: parent ? "REPLICATED" : "SEED",
        parentAssignmentId: parent?.id,
        inboundMailId: f("mailId") || undefined,
      },
    });
    if (parent) await markReplicated(tx, parent.id);
    if (f("mailId")) {
      await tx.inboundMail.update({
        where: { id: f("mailId") },
        data: { status: "PROCESSED", note: "code entered by admin" },
      });
    }
  },

  async "outbox-retry"(tx, f) {
    const m = await tx.outboundMail.findUniqueOrThrow({ where: { id: f("id") }, include: { assignment: true } });
    if (m.assignment?.revokedAt) return "assignment is revoked";
    await tx.outboundMail.update({
      where: { id: f("id") },
      data: { status: "PENDING", attempts: 0 },
    });
  },
};

async function markReplicated(tx: Tx, assignmentId: string) {
  const a = await tx.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
  const now = new Date();
  await tx.assignment.update({
    where: { id: a.id },
    data: { replicatedAt: a.replicatedAt ?? now, confirmedAt: a.confirmedAt ?? now },
  });
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  if (!(await adminUser()) || !sameOrigin(request)) return new Response("forbidden", { status: 403 });
  const { action } = await ctx.params;
  const form = await request.formData();
  const f = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : "";
  };
  const back = f("back").startsWith("/admin") ? f("back") : "/admin";

  let error: string | void = undefined;
  if (action === "tick") {
    await tick();
  } else {
    const handler = handlers[action];
    if (!handler) return new Response("unknown action", { status: 404 });
    error = await prisma.$transaction(async (tx) => {
      await lock(tx);
      const err = await handler(tx, f);
      if (!err) await distribute(tx);
      return err;
    }, { timeout: 30_000 });
  }

  const location = error ? `${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : back;
  return new Response(null, { status: 303, headers: { Location: location } });
}

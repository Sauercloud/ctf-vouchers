"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentTeamId } from "@/lib/auth";
import { config } from "@/lib/config";
import { cancelPendingMails, distribute, getState, lock } from "@/lib/distribute";
import { parseRaises, serializeRaises, updateRaises } from "@/lib/order";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type ActionResult = { success: true } | { success: false; error: string };

export async function saveRegistration(input: {
  requested: number;
  contactEmail: string;
}): Promise<ActionResult> {
  const teamId = await currentTeamId();
  if (!teamId) return { success: false, error: "Authentication required." };

  const parsed = z
    .object({
      requested: z.number().int().min(0).max(config.maxRequest),
      contactEmail: z.email(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: `Please enter a valid email and between 0 and ${config.maxRequest} vouchers.`,
    };
  }
  const { requested, contactEmail } = parsed.data;

  return prisma.$transaction(async (tx) => {
    await lock(tx);
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) return { success: false, error: "Unknown team, please log in again." };
    if (team.banned) return { success: false, error: "Your team is excluded from the distribution." };

    const state = await getState(tx);
    const data: Prisma.TeamUpdateInput = {
      requested,
      contactEmail,
      registeredAt: team.registeredAt ?? new Date(),
    };
    if (state.frozenAt) {
      // After the freeze, a late registration or a raise sends the new
      // vouchers to the back of every round, behind earlier raises.
      let base = state.frozenTeamIds.includes(team.id) ? (team.frozenRequested ?? 0) : 0;
      // Lowering below the frozen request shrinks it for good.
      if (requested < base) data.frozenRequested = base = requested;
      data.raises = serializeRaises(updateRaises(parseRaises(team.raises), base, requested, new Date()));
    }

    await tx.team.update({ where: { id: teamId }, data });
    // A late registration may be able to take a free voucher right away.
    await distribute(tx);
    revalidatePath("/dashboard");
    return { success: true } as const;
  });
}

// The team can't use a voucher: revoke it so it goes to the next team. The
// slot stays used, otherwise the same team would get the voucher back.
export async function giveBack(assignmentId: string): Promise<ActionResult> {
  const teamId = await currentTeamId();
  if (!teamId) return { success: false, error: "Authentication required." };

  return prisma.$transaction(async (tx) => {
    await lock(tx);
    const a = await tx.assignment.findUnique({ where: { id: assignmentId } });
    if (!a || a.teamId !== teamId || a.revokedAt) {
      return { success: false, error: "Voucher not found." };
    }
    if (a.confirmedAt || a.replicatedAt) {
      return { success: false, error: "You already confirmed this voucher." };
    }
    const err = await cancelPendingMails(tx, a.id);
    if (err) return { success: false, error: err };
    await tx.assignment.update({
      where: { id: a.id },
      data: { revokedAt: new Date(), revokeReason: "given back by team" },
    });
    await distribute(tx);
    revalidatePath("/dashboard");
    return { success: true } as const;
  });
}

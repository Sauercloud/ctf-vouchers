"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { User } from "@/generated/prisma";

const DEADLINE = new Date("2025-10-20T12:00:00");

export const saveFormRequest = async (
  tickets: number,
  contactEmail: string
) => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.name) {
    return { success: false, error: "Authentication required." };
  }

  const teamId = (session.user as User).id;

  if (isNaN(Number(tickets)) || !contactEmail) {
    return { success: false, error: "Invalid input data." };
  }

  try {
    const current = await prisma.formResponse.findFirst({
      where: { teamId },
    });

    if (
      new Date() > DEADLINE &&
      Number(tickets) > (current?.numberOfTickets ?? 0)
    ) {
      return { success: false, error: "Deadline" };
    }

    await prisma.formResponse.upsert({
      where: { teamId },
      update: {
        numberOfTickets: Number(tickets),
        contactEmail: contactEmail,
      },
      create: {
        teamId: teamId,
        numberOfTickets: Number(tickets),
        contactEmail: contactEmail,
      },
    });

    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to save ticket request:", error);
    return { success: false, error: "An error occurred while saving." };
  }
};

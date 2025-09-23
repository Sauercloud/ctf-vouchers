"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { User } from "@/generated/prisma";

export const saveFormRequest = async (tickets: number, contactEmail: string) => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.name) {
    return { success: false, error: "Authentication required." };
  }

  const teamId = (session.user as User).id;

  if (isNaN(Number(tickets)) || !contactEmail) {
    return { success: false, error: "Invalid input data." };
  }

  try {
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
}

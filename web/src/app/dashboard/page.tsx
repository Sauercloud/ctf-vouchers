import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { TicketForm } from "@/components/TicketForm";
import { User } from "@/generated/prisma";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.name) {
    redirect("/api/auth/signin");
  }

  const userId = (session.user as User).id;

  const formResponse = await prisma.formResponse.findUnique({
    where: {
      teamId: userId,
    },
  });

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <div className="max-w-2xl mx-auto bg-gray-800 rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-cyan-400">Team Dashboard</h1>
          <p className="text-gray-400 mt-2">
            Welcome, <span className="font-bold text-white">{session.user.name}</span>!
          </p>
          <p className="text-gray-300">
            Manage your voucher request for 39C3 here.
          </p>
        </div>
        
        <TicketForm 
          currentData={formResponse ? {
            tickets: formResponse.numberOfTickets,
            contactEmail: formResponse.contactEmail,
          } : {
            tickets: 0,
            contactEmail: '',
          }} 
        />
      </div>
    </main>
  );
}


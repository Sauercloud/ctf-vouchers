import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import { getTeamDetails } from "@/lib/ctftime";
import { prisma } from "@/lib/prisma";

interface CtftimeProfile {
  team: { id: number; name: string; logo: string };
}

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "ctftime",
      name: "CTFtime",
      type: "oauth",
      authorization: {
        url: "https://oauth.ctftime.org/authorize",
        params: { scope: "team:read" },
      },
      token: "https://oauth.ctftime.org/token",
      userinfo: "https://oauth.ctftime.org/user",
      clientId: process.env.AUTH_CTFTIME_ID as string,
      clientSecret: process.env.AUTH_CTFTIME_SECRET as string,
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
      profile(profile: CtftimeProfile) {
        return {
          id: profile.team.id.toString(),
          name: profile.team.name,
          image: profile.team.logo,
        };
      },
    },
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ profile }) {
      const teamId = (profile as CtftimeProfile | undefined)?.team?.id;
      if (!teamId) return false;

      const team = await getTeamDetails(teamId);
      if (!team) return false;

      // Only teams that have participated in at least one event
      const played = Object.values(team.rating).some(
        (v) =>
          v.country_place + v.organizer_points + v.rating_place + v.rating_points !== 0,
      );
      if (!played) return false;

      await prisma.team.upsert({
        where: { id: teamId },
        update: { name: team.name },
        create: { id: teamId, name: team.name },
      });
      return true;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
};

// CTFtime team id of the logged in team, or null.
export async function currentTeamId(): Promise<number | null> {
  const session = await getServerSession(authOptions);
  const id = Number(session?.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

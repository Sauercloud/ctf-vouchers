import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getTeamDetails } from "@/lib/ctftime";
import { User } from "@/generated/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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
      profile(profile) {
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
      if (profile) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const team = await getTeamDetails((profile as any).team.id);

        if (team) {
          // Check if team has participated in any event
          const x = Object.values(team.rating).reduce(
            (values, v) =>
              values +
              v.country_place +
              v.organizer_points +
              v.rating_place +
              v.rating_points,
            0
          );
          if (x != 0) {
            return true
          }
        }
      }
      return false;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as User).id = token.id as string;
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

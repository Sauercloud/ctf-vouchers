"use server";

import { prisma } from "@/lib/prisma";
import seedrandom from "seedrandom";

const SEED = "3456789021";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shuffle(rng: any, array: any[]) {
  let m = array.length,
    t,
    i;

  // While there remain elements to shuffle…
  while (m) {
    // Pick a remaining element…
    i = Math.floor(rng() * m--);

    // And swap it with the current element.
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }

  return array;
}

export const getSequence = async () => {
  const rng = seedrandom(SEED);

  try {
    const team_names = await prisma.user.findMany();
    const name_mapping = new Map();
    team_names.forEach((x) => {
      name_mapping.set(x.id, x.name);
    });

    const max = await prisma.formResponse.aggregate({
      _max: {
        numberOfTickets: true,
      },
    });

    const max_requested = max._max.numberOfTickets ?? 0;

    const sequece = [];

    for (let i = 0; i < max_requested; i += 2) {
      const teams = await prisma.formResponse.findMany({
        where: {
          numberOfTickets: {
            gte: i,
          },
        },
      });

      const eligeble_teams = teams.map((x) => x.teamId);
      sequece.push(
        shuffle(
          rng,
          eligeble_teams.map((x) => name_mapping.get(x))
        )
      );
    }

    const name_sequece = sequece;

    return { sequence: name_sequece };
  } catch (error) {
    console.error("Failed to calc sequcne:", error);
    return { sequence: [] };
  }
};

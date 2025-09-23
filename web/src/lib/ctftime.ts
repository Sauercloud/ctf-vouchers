export interface YearRating {
  rating_place: number;
  organizer_points: number;
  rating_points: number;
  country_place: number;
}

export interface Team {
  academic: string;
  primary_alias: string;
  name: string;
  rating: {
    [year: number]: YearRating;
  };
  logo: string;
  country: string;
  id: number;
  aliases: string[];
}

const BASE_URL: string = "https://ctftime.org/api/v1";

export const getTeamDetails = async (teamId: number): Promise<Team | null> => {
  const url = `${BASE_URL}/teams/${teamId}/`;

  const response = await fetch(url);

  if (!response.ok) {
    console.error(
      `Failed to fetch team data. Status: ${response.status}`,
      response.status
    );
    return null;
  }

  const data: Team = await response.json();
  return data;
};

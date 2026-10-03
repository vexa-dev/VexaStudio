import { useQuery } from "@tanstack/react-query";
import { services } from "@/services";

export function useTeamOverview() {
  return useQuery({
    queryKey: ["team", "overview"],
    queryFn: async () => {
      const [profiles, dailyUpdates] = await Promise.all([
        services.members.list(),
        services.daily.list(),
      ]);
      return { profiles: profiles.filter((profile) => profile.role !== "collaborator"), dailyUpdates };
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { services } from "@/services";

export function useTeamOverview() {
  return useQuery({
    queryKey: ["team", "overview"],
    queryFn: async () => {
      const [profiles, dailyUpdates, tasks, entries, projects] =
        await Promise.all([
          services.members.list(),
          services.daily.list(),
          services.tasks.list(),
          services.time.listEntries(),
          services.projects.list(),
        ]);
      return { profiles, dailyUpdates, tasks, entries, projects };
    },
  });
}

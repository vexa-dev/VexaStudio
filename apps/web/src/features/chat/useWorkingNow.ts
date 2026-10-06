import { useQuery } from "@tanstack/react-query";
import { services } from "@/services";
import { resolveWorkingNow, type WorkingNow } from "./working-now";

/** Covers "since the start of yesterday" in any timezone. */
const LOOKBACK_MS = 48 * 60 * 60 * 1000;
const POLL_MS = 30_000;

/**
 * Project and task someone is on right now. Never throws: a viewer who cannot
 * read the member's hours just gets the manually pinned project (or nothing).
 */
export function useWorkingNow(
  memberId: string,
  manualProjectId: string | null,
) {
  return useQuery<WorkingNow | null>({
    queryKey: ["chat", "working-now", memberId, manualProjectId],
    queryFn: async () => {
      const safe = async <T>(load: () => Promise<T[]>): Promise<T[]> => {
        try {
          return (await load()) ?? [];
        } catch {
          return [];
        }
      };
      const from = new Date(Date.now() - LOOKBACK_MS).toISOString();
      const [entries, projects] = await Promise.all([
        safe(() => services.time.listEntries({ userId: memberId, from })),
        safe(() => services.projects.list()),
      ]);
      const running =
        entries.find(
          (e) =>
            e.userId === memberId &&
            e.endedAt === null &&
            !e.voidedAt &&
            e.timerState !== "paused",
        ) ?? null;
      const tasks = running ? await safe(() => services.tasks.list({})) : [];
      return resolveWorkingNow({ running, manualProjectId, tasks, projects });
    },
    enabled: memberId !== "",
    refetchInterval: POLL_MS,
    retry: false,
  });
}

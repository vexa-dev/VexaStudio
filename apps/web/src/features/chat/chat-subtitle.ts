import type { WorkingNow } from "./working-now";
import { developingLabel } from "./working-label";

export interface ChatSubtitleInput {
  kind: "direct" | "group";
  working: WorkingNow | null;
  online: boolean;
  status: string;
  memberCount: number;
}

/** Second line of the conversation header. */
export function chatSubtitle({
  kind,
  working,
  online,
  status,
  memberCount,
}: ChatSubtitleInput): string {
  if (kind === "group")
    return `${memberCount} ${memberCount === 1 ? "integrante" : "integrantes"}`;
  const developing = developingLabel(working);
  if (developing) return developing;
  const presence = online ? "En línea" : "Sin conexión";
  return status ? `${presence} · ${status}` : presence;
}

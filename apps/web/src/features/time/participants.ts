import type { HoursParticipantInput } from "@vexa/services";
import { formatHours } from "@vexa/domain/format";
import { participantsSchema } from "./schemas";

/** `2 h al 75 % = 1.5 h para Rober`; without hours yet, only the share. */
export function creditExample(
  hours: number | undefined,
  sharePercent: number,
  name: string,
): string {
  if (!Number.isFinite(sharePercent)) return "";
  if (!hours || !Number.isFinite(hours) || hours <= 0)
    return `${sharePercent} % de las horas para ${name}`;
  return `${formatHours(hours)} al ${sharePercent} % = ${formatHours((hours * sharePercent) / 100)} para ${name}`;
}

/** Error message per row (by index) plus a list-level one, empty when the tags are valid. */
export function participantErrors(
  ownerId: string,
  list: HoursParticipantInput[],
): { rows: Record<number, string>; list: string | null } {
  const result = participantsSchema(ownerId).safeParse(
    list.map((p) => ({ userId: p.userId, sharePercent: p.sharePercent ?? 100 })),
  );
  const rows: Record<number, string> = {};
  let general: string | null = null;
  if (!result.success)
    for (const issue of result.error.issues) {
      const index = issue.path[0];
      if (typeof index === "number") rows[index] ??= issue.message;
      else general ??= issue.message;
    }
  return { rows, list: general };
}

export const hasParticipantErrors = (errors: ReturnType<typeof participantErrors>) =>
  errors.list !== null || Object.keys(errors.rows).length > 0;

/** Same people and shares, in any order. */
export function sameParticipants(
  a: HoursParticipantInput[],
  b: HoursParticipantInput[],
): boolean {
  if (a.length !== b.length) return false;
  const share = (p: HoursParticipantInput) => p.sharePercent ?? 100;
  const byId = new Map(b.map((p) => [p.userId, share(p)]));
  return a.every((p) => byId.get(p.userId) === share(p));
}

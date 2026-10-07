import { normalizeDailyInput, type DailyFields, type DailyRecord } from "@vexa/domain/daily";
import type { DailyDraft } from "./day-storage";

const HELP_PREFIX = "Necesito ayuda de: ";

/** Lo que se comparte con el equipo: "qué sigue" es `willDo` y a quién se pide ayuda va con los bloqueos. */
export function draftToDaily(draft: DailyDraft): DailyFields {
  const blockers = draft.blockers.trim();
  const help = (draft.needsFrom ?? "").trim();
  return normalizeDailyInput({
    done: draft.done,
    willDo: draft.next,
    blockers: blockers && help ? `${blockers}\n${HELP_PREFIX}${help}` : blockers,
  });
}

/** Borrador a partir de un daily ya enviado (para corregirlo). */
export function dailyToDraft(daily: DailyRecord): DailyDraft {
  const [blockers, ...rest] = daily.blockers.split("\n");
  const last = rest.at(-1);
  const hasHelp = last?.startsWith(HELP_PREFIX) ?? false;
  return {
    done: daily.done,
    next: daily.willDo,
    blockers: hasHelp ? [blockers, ...rest.slice(0, -1)].join("\n") : daily.blockers,
    needsFrom: hasHelp && last ? last.slice(HELP_PREFIX.length) : "",
  };
}

export const isDraftEmpty = (draft: DailyDraft) =>
  !draft.done.trim() && !draft.next.trim() && !draft.blockers.trim();

/** El borrador dice lo mismo que lo ya enviado. */
export function matchesSent(draft: DailyDraft, sent: DailyRecord): boolean {
  const a = draftToDaily(draft);
  const b = normalizeDailyInput(sent);
  return a.done === b.done && a.willDo === b.willDo && a.blockers === b.blockers;
}

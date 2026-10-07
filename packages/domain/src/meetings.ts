import { addDays } from "date-fns";
import { todayLima, weekRange } from "./dates";
import type { Id, IsoDate, IsoDateTime, Meeting, MeetingSlot, SlotVote } from "./types";

/** Reglas puras de la convocatoria semanal. SQL aplica las mismas (supabase/migrations/…_reuniones.sql). */

export const MIN_SLOTS = 2;
export const MAX_SLOTS = 3;
export const MEET_LINK_MAX_LENGTH = 500;
/** Horas sin responder a partir de las cuales se muestra el aviso derivado (no hay un reloj que lo dispare). */
export const VOTE_REMINDER_HOURS = 24;

/** Lunes (Lima) de la semana que contiene `value`, como `YYYY-MM-DD`. */
export function limaWeekMonday(value: Date | string): IsoDate {
  return todayLima(weekRange(value).start);
}

/** Lunes siguiente al `monday` dado. */
function nextMonday(monday: IsoDate): IsoDate {
  return limaWeekMonday(addDays(new Date(`${monday}T12:00:00-05:00`), 7));
}

/**
 * Valida los horarios propuestos: 2 o 3, distintos, futuros y dentro de una misma semana de Lima que sea
 * la actual o la siguiente. Devuelve el mensaje de error o `null`.
 */
export function validateSlotStarts(slotStarts: IsoDateTime[], now: Date = new Date()): string | null {
  if (slotStarts.length < MIN_SLOTS || slotStarts.length > MAX_SLOTS)
    return `Propón 2 o 3 horarios`;
  const times = slotStarts.map((s) => new Date(s).getTime());
  if (times.some((t) => Number.isNaN(t))) return "Hay un horario con fecha u hora no válida";
  if (new Set(times).size !== times.length) return "Los horarios deben ser distintos";
  if (times.some((t) => t <= now.getTime())) return "Los horarios deben estar en el futuro";
  const weeks = new Set(times.map((t) => limaWeekMonday(new Date(t))));
  if (weeks.size > 1) return "Los horarios deben ser de la misma semana";
  const [week] = [...weeks];
  const thisMonday = limaWeekMonday(now);
  if (week !== thisMonday && week !== nextMonday(thisMonday))
    return "Los horarios deben ser de esta semana o la siguiente";
  return null;
}

/** Lunes (Lima) de la convocatoria: el de sus horarios (ya validados como una sola semana). */
export function meetingWeekOf(slotStarts: IsoDateTime[]): IsoDate {
  return limaWeekMonday(slotStarts[0]);
}

const HTTPS_LINK = /^https:\/\/[^\s/]+\.[^\s/]+(\/\S*)?$/;

/** El enlace de la reunión debe ser una URL https (se prefiere meet.google.com, pero no se exige). */
export function validateMeetLink(link: string): string | null {
  const value = link.trim();
  if (!value) return "Pega el enlace de la reunión";
  if (value.length > MEET_LINK_MAX_LENGTH)
    return `El enlace admite hasta ${MEET_LINK_MAX_LENGTH} caracteres`;
  // Misma regla que la guarda de SQL: https, un dominio con punto y sin espacios.
  if (!HTTPS_LINK.test(value)) return "El enlace debe ser una URL https";
  return null;
}

/** `true` si el enlace es de Google Meet (para avisar, sin bloquear, cuando es de otro servicio). */
export function isMeetLink(link: string): boolean {
  return /^https:\/\/meet\.google\.com(\/|$)/i.test(link.trim());
}

export interface SlotAvailability {
  slotId: Id;
  startsAt: IsoDateTime;
  yes: number;
  no: number;
}

/** Disponibilidad por horario, del mejor al peor: más "sí" primero y, en empate, el más temprano. */
export function slotAvailability(slots: MeetingSlot[], votes: SlotVote[]): SlotAvailability[] {
  return slots
    .map((slot) => {
      const own = votes.filter((v) => v.slotId === slot.id);
      return {
        slotId: slot.id,
        startsAt: slot.startsAt,
        yes: own.filter((v) => v.available).length,
        no: own.filter((v) => !v.available).length,
      };
    })
    .sort((a, b) => b.yes - a.yes || a.startsAt.localeCompare(b.startsAt));
}

/**
 * Quién no ha respondido. Sin `slotIds`, basta un voto; con ellos, hay que responder todos los horarios.
 */
export function pendingVoters<T extends { id: Id }>(members: T[], votes: SlotVote[], slotIds?: Id[]): T[] {
  return members.filter((member) => {
    const answered = new Set(votes.filter((v) => v.userId === member.id).map((v) => v.slotId));
    return slotIds ? !slotIds.every((id) => answered.has(id)) : answered.size === 0;
  });
}

/** Indicador derivado "sin responder hace más de 24 h": se calcula desde la convocatoria, no es un trabajo programado. */
export function isVoteReminderDue(createdAt: IsoDateTime, now: Date = new Date()): boolean {
  return now.getTime() - new Date(createdAt).getTime() >= VOTE_REMINDER_HOURS * 3_600_000;
}

/**
 * Reuniones realizadas seguidas sin asistir, contando desde la más reciente (regla de incumplimiento:
 * dos seguidas). Aún no se conecta al dashboard.
 */
export function consecutiveAbsences(meetings: Meeting[], userId: Id): number {
  const held = meetings.filter((m) => m.status === "held").sort((a, b) => b.week.localeCompare(a.week));
  let count = 0;
  for (const meeting of held) {
    if (meeting.attendeeIds.includes(userId)) break;
    count++;
  }
  return count;
}

/**
 * Convocatoria que se muestra: la primera no realizada desde la semana en curso; si todas ya se
 * realizaron, la de la semana en curso; si no hay ninguna, `null`.
 */
export function pickCurrentMeeting(meetings: Meeting[], thisMonday: IsoDate): Meeting | null {
  const upcoming = meetings.filter((m) => m.week >= thisMonday).sort((a, b) => a.week.localeCompare(b.week));
  return (
    upcoming.find((m) => m.status !== "held" && m.status !== "cancelled") ??
    upcoming.find((m) => m.week === thisMonday) ??
    null
  );
}

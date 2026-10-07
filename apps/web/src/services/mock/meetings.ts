import { canAccessStudio } from "@vexa/domain/access";
import {
  limaWeekMonday,
  meetingWeekOf,
  pickCurrentMeeting,
  validateMeetLink,
  validateSlotStarts,
} from "@vexa/domain/meetings";
import { formatDate } from "@vexa/domain/dates";
import type { Id, Meeting, Profile } from "@vexa/domain/types";
import type { MeetingDetail, MeetingService } from "@vexa/services";
import { getDb, getSessionUserId, save } from "./db";
import { delay } from "./utils";

function currentUser(): Profile {
  const user = getDb().profiles.find((p) => p.id === getSessionUserId() && p.active);
  if (!user) throw new Error("Inicia sesión para continuar");
  return user;
}

function currentAdmin(): Profile {
  const user = currentUser();
  if (user.role !== "admin") throw new Error("Solo el product owner puede hacerlo");
  return user;
}

function detailOf(meeting: Meeting): MeetingDetail {
  const db = getDb();
  const slots = db.meetingSlots
    .filter((s) => s.meetingId === meeting.id)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const slotIds = new Set(slots.map((s) => s.id));
  return { meeting, slots, votes: db.slotVotes.filter((v) => slotIds.has(v.slotId)) };
}

function findMeeting(id: Id): Meeting {
  const meeting = getDb().meetings.find((m) => m.id === id);
  if (!meeting) throw new Error("El registro no existe o no tienes permiso");
  return meeting;
}

/** Un aviso `meeting` por admin o socio activo, salvo quien actúa (lo que en SQL hace un trigger). */
function notifyStudio(actor: Profile, payload: (recipient: Profile) => Record<string, string>) {
  const db = getDb();
  const now = new Date().toISOString();
  for (const recipient of db.profiles) {
    if (!recipient.active || !canAccessStudio(recipient.role) || recipient.id === actor.id) continue;
    db.notifications.push({
      id: `n-${crypto.randomUUID()}`,
      userId: recipient.id,
      type: "meeting",
      payload: {
        actorName: actor.name,
        actorRole: actor.role === "admin" ? "Administrador" : "Socio",
        recipientName: recipient.name,
        ...payload(recipient),
      },
      read: false,
      createdAt: now,
    });
  }
}

const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );

/**
 * Convocatoria semanal del mock. Espeja `meetings`, `meeting_slots` y `slot_votes` de SQL: las leen admin y
 * socios (un colaborador no ve nada); solo admin convoca, confirma (enlace https) y marca asistencia
 * (después de que empiece el horario confirmado); los votos son propios y se cierran al confirmar.
 */
export const meetingService: MeetingService = {
  async getCurrent() {
    const user = currentUser();
    if (!canAccessStudio(user.role)) return delay(null);
    const meeting = pickCurrentMeeting(getDb().meetings, limaWeekMonday(new Date()));
    return delay(meeting ? detailOf(meeting) : null);
  },
  async propose(slotStarts) {
    const message = validateSlotStarts(slotStarts);
    if (message) throw new Error(message);
    const user = currentAdmin();
    const db = getDb();
    const week = meetingWeekOf(slotStarts);
    if (db.meetings.some((m) => m.week === week)) throw new Error("Ya hay una convocatoria para esa semana");
    const meeting: Meeting = {
      id: `m-${crypto.randomUUID()}`,
      week,
      status: "polling",
      confirmedSlotId: null,
      meetLink: null,
      attendeeIds: [],
      createdAt: new Date().toISOString(),
    };
    db.meetings.push(meeting);
    for (const startsAt of slotStarts) {
      db.meetingSlots.push({ id: `ms-${crypto.randomUUID()}`, meetingId: meeting.id, startsAt: new Date(startsAt).toISOString() });
    }
    notifyStudio(user, () => ({
      title: "Nueva convocatoria de reunión",
      message: `${user.name} propuso ${slotStarts.length} horarios para la reunión semanal. Marca tu disponibilidad.`,
      meetingId: meeting.id,
      week,
      nextStep: "Abre Mi día y vota los horarios.",
    }));
    save();
    return delay(detailOf(meeting));
  },
  async vote(slotId, available) {
    const user = currentUser();
    if (!canAccessStudio(user.role)) throw new Error("Tu rol no permite esta acción");
    const db = getDb();
    const slot = db.meetingSlots.find((s) => s.id === slotId);
    if (!slot) throw new Error("El horario no existe o no tienes permiso");
    const meeting = findMeeting(slot.meetingId);
    if (meeting.status !== "polling") throw new Error("La votación ya terminó");
    const existing = db.slotVotes.find((v) => v.slotId === slotId && v.userId === user.id);
    if (existing) existing.available = available;
    else db.slotVotes.push({ slotId, userId: user.id, available });
    save();
    return delay(detailOf(meeting));
  },
  async confirm(meetingId, slotId, meetLink) {
    const message = validateMeetLink(meetLink);
    if (message) throw new Error(message);
    const user = currentAdmin();
    const meeting = findMeeting(meetingId);
    if (meeting.status !== "polling") throw new Error("Esa transición de la convocatoria no está permitida");
    const slot = getDb().meetingSlots.find((s) => s.id === slotId && s.meetingId === meetingId);
    if (!slot) throw new Error("El horario no pertenece a esta convocatoria");
    meeting.status = "confirmed";
    meeting.confirmedSlotId = slot.id;
    meeting.meetLink = meetLink.trim();
    notifyStudio(user, () => ({
      title: "Reunión semanal confirmada",
      message: `La reunión será el ${formatDate(slot.startsAt)} a las ${timeLabel(slot.startsAt)} (hora de Lima).`,
      meetingId,
      startsAt: slot.startsAt,
      meetLink: meeting.meetLink ?? "",
      details: `Enlace: ${meeting.meetLink}`,
      nextStep: "Únete con el enlace a la hora indicada.",
    }));
    save();
    return delay(detailOf(meeting));
  },
  async markAttendance(meetingId, attendeeIds) {
    currentAdmin();
    const db = getDb();
    const meeting = findMeeting(meetingId);
    if (meeting.status !== "confirmed") throw new Error("Esa transición de la convocatoria no está permitida");
    const slot = db.meetingSlots.find((s) => s.id === meeting.confirmedSlotId);
    if (!slot || new Date(slot.startsAt).getTime() > Date.now())
      throw new Error("La asistencia se marca cuando la reunión ya empezó");
    const unique = [...new Set(attendeeIds)];
    const valid = unique.every((id) => {
      const person = db.profiles.find((p) => p.id === id);
      return person?.active && canAccessStudio(person.role);
    });
    if (!valid) throw new Error("Solo admin y socios activos pueden asistir");
    meeting.attendeeIds = unique;
    meeting.status = "held";
    save();
    return delay(detailOf(meeting));
  },
};

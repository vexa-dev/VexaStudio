import { canAccessStudio } from "@vexa/domain/access";
import {
  limaWeekMonday,
  pickCurrentMeeting,
  validateMeetLink,
  validateSlotStarts,
} from "@vexa/domain/meetings";
import type { Id } from "@vexa/domain/types";
import type { MeetingDetail, MeetingService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import type { Tables } from "./database.types";
import { toServiceError, unwrap, unwrapMaybe } from "./errors";
import { mapMeeting, mapMeetingSlot, mapSlotVote } from "./mappers";
import { getCurrentProfile } from "./session";

/**
 * Convocatoria semanal sobre `meetings`, `meeting_slots` y `slot_votes`. Las leen admin y socios (a un
 * colaborador RLS le devuelve vacío); solo admin convoca (RPC `propose_meeting`), confirma y marca asistencia,
 * y los votos son propios. La base valida de nuevo cada regla. Nadie borra.
 */
export function createMeetingService(client: VexaSupabase): MeetingService {
  async function requireStudio() {
    const profile = await getCurrentProfile(client);
    if (!canAccessStudio(profile.role)) throw new Error("Tu rol no permite esta acción");
    return profile;
  }
  async function requireAdmin() {
    const profile = await getCurrentProfile(client);
    if (profile.role !== "admin") throw new Error("Solo el product owner puede hacerlo");
    return profile;
  }

  async function detailOf(row: Tables<"meetings">): Promise<MeetingDetail> {
    const slotRows = unwrap(
      await client.from("meeting_slots").select("*").eq("meeting_id", row.id).order("starts_at"),
    );
    const slotIds = slotRows.map((s) => s.id);
    const voteRows = slotIds.length
      ? unwrap(await client.from("slot_votes").select("*").in("slot_id", slotIds))
      : [];
    return {
      meeting: mapMeeting(row),
      slots: slotRows.map(mapMeetingSlot),
      votes: voteRows.map(mapSlotVote),
    };
  }

  async function detailById(id: Id): Promise<MeetingDetail> {
    const row = unwrap(
      await client
        .from("meetings")
        .select("*")
        .eq("id", id)
        .single()
        .overrideTypes<Tables<"meetings">, { merge: false }>(),
    );
    return detailOf(row);
  }

  return {
    async getCurrent() {
      await getCurrentProfile(client);
      const thisMonday = limaWeekMonday(new Date());
      const rows = unwrap(
        await client.from("meetings").select("*").gte("week", thisMonday).order("week"),
      );
      const picked = pickCurrentMeeting(rows.map(mapMeeting), thisMonday);
      const row = picked ? rows.find((r) => r.id === picked.id) : undefined;
      return row ? detailOf(row) : null;
    },
    async propose(slotStarts) {
      const message = validateSlotStarts(slotStarts);
      if (message) throw new Error(message);
      await requireAdmin();
      const id = unwrap(
        await client.rpc("propose_meeting", { p_slots: slotStarts.map((s) => new Date(s).toISOString()) }),
      );
      return detailById(id as Id);
    },
    async vote(slotId, available) {
      const profile = await requireStudio();
      const slot = unwrapMaybe(
        await client
          .from("meeting_slots")
          .select("*")
          .eq("id", slotId)
          .maybeSingle()
          .overrideTypes<Tables<"meeting_slots"> | null, { merge: false }>(),
      );
      if (!slot) throw new Error("El horario no existe o no tienes permiso");
      // Cambia el voto propio si existe; si no, lo crea (user_id lo llena la base con auth.uid()).
      const updated = unwrap(
        await client
          .from("slot_votes")
          .update({ available })
          .eq("slot_id", slotId)
          .eq("user_id", profile.id)
          .select("slot_id"),
      );
      if (updated.length === 0) {
        const { error } = await client.from("slot_votes").insert({ slot_id: slotId, available });
        if (error) throw toServiceError(error);
      }
      return detailById(slot.meeting_id);
    },
    async confirm(meetingId, slotId, meetLink) {
      const message = validateMeetLink(meetLink);
      if (message) throw new Error(message);
      await requireAdmin();
      const updated = unwrap(
        await client
          .from("meetings")
          .update({ status: "confirmed", confirmed_slot_id: slotId, meet_link: meetLink.trim() })
          .eq("id", meetingId)
          .eq("status", "polling")
          .select("id"),
      );
      if (updated.length === 0) throw new Error("La convocatoria ya no admite cambios");
      return detailById(meetingId);
    },
    async markAttendance(meetingId, attendeeIds) {
      await requireAdmin();
      const updated = unwrap(
        await client
          .from("meetings")
          .update({ status: "held", attendee_ids: [...new Set(attendeeIds)] })
          .eq("id", meetingId)
          .eq("status", "confirmed")
          .select("id"),
      );
      if (updated.length === 0) throw new Error("La convocatoria ya no admite cambios");
      return detailById(meetingId);
    },
  };
}

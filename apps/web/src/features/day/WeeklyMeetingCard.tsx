import { Check, ChevronDown, ExternalLink, Users, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { canAccessStudio } from "@vexa/domain/access";
import { formatDateTime } from "@vexa/domain/dates";
import {
  isVoteReminderDue,
  pendingVoters,
  slotAvailability,
} from "@vexa/domain/meetings";
import type { Id, IsoDateTime } from "@vexa/domain/types";
import type { MeetingDetail } from "@vexa/services";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMembers } from "@/features/team/hooks/useMembers";
import { useCurrentMeeting, useMeetingActions } from "@/features/meetings/hooks/useMeetings";
import { AttendanceSheet, ConfirmMeetingSheet, ProposeMeetingSheet } from "./MeetingSheets";

/**
 * Reunión semanal en Mi día: sin convocatoria (el admin convoca), votación de horarios, confirmada con
 * enlace y realizada con asistencia. La ven admin y socios; un colaborador no ve la tarjeta. El aviso
 * "Sin responder hace +24 h" se deriva de la fecha de la convocatoria: no hay un trabajo programado.
 */
export function WeeklyMeetingCard() {
  const { user } = useAuth();
  const studio = canAccessStudio(user?.role);
  const meeting = useCurrentMeeting(studio);
  const members = useMembers();
  const [open, setOpen] = useState(true);
  const [proposing, setProposing] = useState(false);

  if (!user || !studio) return null;
  const isAdmin = user.role === "admin";
  const studioMembers = (members.data ?? []).filter((m) => m.active && canAccessStudio(m.role));
  const detail = meeting.data ?? null;

  return (
    <Card className="day-meeting-card">
      <div className="day-card-title">
        <h2>
          <Video size={18} aria-hidden="true" /> Reunión semanal
        </h2>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-lg text-muted"
          aria-expanded={open}
          aria-label={open ? "Plegar la reunión semanal" : "Desplegar la reunión semanal"}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown size={18} aria-hidden="true" className={open ? "rotate-180" : undefined} />
        </button>
      </div>

      {open &&
        (meeting.isLoading ? (
          <Skeleton className="h-20" />
        ) : meeting.isError ? (
          <ErrorState title="No se pudo cargar la reunión" onRetry={() => void meeting.refetch()} />
        ) : !detail ? (
          <div className="flex flex-col items-start gap-3">
            <p className="day-note">Aún no hay convocatoria para esta semana.</p>
            {isAdmin && <Button onClick={() => setProposing(true)}>Convocar reunión</Button>}
          </div>
        ) : (
          <MeetingBody detail={detail} members={studioMembers} userId={user.id} isAdmin={isAdmin} />
        ))}

      {isAdmin && <ProposeMeetingSheet open={proposing} onClose={() => setProposing(false)} />}
    </Card>
  );
}

function MeetingBody({
  detail,
  members,
  userId,
  isAdmin,
}: {
  detail: MeetingDetail;
  members: { id: Id; name: string }[];
  userId: Id;
  isAdmin: boolean;
}) {
  const { meeting, slots, votes } = detail;
  const { vote } = useMeetingActions();
  const [confirming, setConfirming] = useState<{ meetingId: Id; slotId: Id; startsAt: IsoDateTime } | null>(null);
  const [attending, setAttending] = useState(false);
  // Reloj de la pantalla: sin él, "ya empezó" y "+24 h" quedarían congelados hasta recargar.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const nameOf = (id: Id) => members.find((m) => m.id === id)?.name ?? "Alguien";

  if (meeting.status === "confirmed" || meeting.status === "held") {
    const slot = slots.find((s) => s.id === meeting.confirmedSlotId);
    const started = slot ? new Date(slot.startsAt).getTime() <= now : false;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          <strong className="num">{slot ? formatDateTime(slot.startsAt) : "—"}</strong>{" "}
          <span className="text-muted">(hora de Lima)</span>
        </p>
        {meeting.status === "confirmed" && meeting.meetLink && (
          <a
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg"
            href={meeting.meetLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} aria-hidden="true" /> Unirse
          </a>
        )}
        {meeting.status === "held" ? (
          <p className="day-note">
            Reunión realizada. Asistieron:{" "}
            {meeting.attendeeIds.length ? meeting.attendeeIds.map(nameOf).join(", ") : "nadie registrado"}.
          </p>
        ) : (
          isAdmin && (
            <>
              <Button variant="secondary" disabled={!started} onClick={() => setAttending(true)}>
                <Users size={16} aria-hidden="true" /> Marcar asistencia
              </Button>
              {!started && <p className="day-note">Podrás marcar la asistencia cuando empiece la reunión.</p>}
            </>
          )
        )}
        {attending && (
          <AttendanceSheet
            open
            meetingId={meeting.id}
            members={members}
            initial={slot ? votes.filter((v) => v.slotId === slot.id && v.available).map((v) => v.userId) : []}
            onClose={() => setAttending(false)}
          />
        )}
      </div>
    );
  }

  const ranking = slotAvailability(slots, votes);
  const best = ranking[0]?.yes ? ranking[0].slotId : null;
  const waiting = pendingVoters(members, votes, slots.map((s) => s.id));
  const overdue = isVoteReminderDue(meeting.createdAt, new Date(now));

  return (
    <div className="flex flex-col gap-3">
      <p className="day-note">Marca tu disponibilidad en cada horario (hora de Lima).</p>
      <ul className="flex flex-col gap-3">
        {slots.map((slot) => {
          const counts = ranking.find((r) => r.slotId === slot.id);
          const mine = votes.find((v) => v.slotId === slot.id && v.userId === userId)?.available;
          return (
            <li
              key={slot.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3"
              data-best={slot.id === best}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="num text-sm">{formatDateTime(slot.startsAt)}</strong>
                <span className="num text-xs text-muted">
                  {slot.id === best && <span className="mr-2 font-medium text-primary-text">Mejor opción</span>}
                  {counts?.yes ?? 0} sí · {counts?.no ?? 0} no
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={mine === true ? "primary" : "secondary"}
                  aria-pressed={mine === true}
                  disabled={vote.isPending}
                  onClick={() => vote.mutate({ slotId: slot.id, available: true })}
                >
                  <Check size={14} aria-hidden="true" /> Sí puedo
                </Button>
                <Button
                  size="sm"
                  variant={mine === false ? "primary" : "secondary"}
                  aria-pressed={mine === false}
                  disabled={vote.isPending}
                  onClick={() => vote.mutate({ slotId: slot.id, available: false })}
                >
                  <X size={14} aria-hidden="true" /> No puedo
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirming({ meetingId: meeting.id, slotId: slot.id, startsAt: slot.startsAt })}
                  >
                    Confirmar
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {waiting.length > 0 ? (
        <p className="day-note">
          {overdue && <strong className="mr-1 text-fg">Sin responder hace +24 h:</strong>}
          {overdue ? "" : "Falta responder: "}
          {waiting.map((m) => m.name).join(", ")}.
        </p>
      ) : (
        <p className="day-note">Todo el equipo respondió.</p>
      )}
      {isAdmin && (
        <ConfirmMeetingSheet target={confirming} onClose={() => setConfirming(null)} />
      )}
    </div>
  );
}

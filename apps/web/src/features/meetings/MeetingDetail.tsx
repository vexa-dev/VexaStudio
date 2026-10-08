import { useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMembers } from "@/features/team/hooks/useMembers";
import {
  useMeetingPlanner,
  useMeetingClock,
  meetingDate,
  type Attendance,
} from "./meeting-planner";

export function MeetingDetail({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { meetings, update } = useMeetingPlanner(user?.id ?? "");
  const members = useMembers();
  const now = useMeetingClock();
  const meeting = meetings.find((m) => m.id === id);
  const admin = user?.role === "admin";
  const accessible = admin || meeting?.participants.includes(user?.id ?? "");
  const [notes, setNotes] = useState<string | null>(null);
  const save = (patch: Partial<NonNullable<typeof meeting>>) => {
    if (!meeting || !accessible) return;
    try {
      update((data) => ({
        ...data,
        meetings: data.meetings.map((m) =>
          m.id === id ? { ...m, ...patch } : m,
        ),
      }));
      toast.success("Reunión actualizada");
    } catch {
      toast.error("No se pudo guardar. Intenta nuevamente.");
    }
  };
  return (
    <Sheet
      open={Boolean(meeting && accessible)}
      onClose={() => {
        setNotes(null);
        onClose();
      }}
      title={meeting?.title ?? "Reunión"}
      description="Agenda y participación · Hora de Lima"
    >
      {meeting && accessible && (
        <div className="meeting-detail">
          <div className="meeting-meta">
            <Badge tone={meeting.status === "cancelled" ? "danger" : "primary"}>
              {meeting.status === "completed"
                ? "Finalizada"
                : meeting.status === "cancelled"
                  ? "Cancelada"
                  : "Programada"}
            </Badge>
            <span>
              {meetingDate(meeting.date)} · {meeting.time} · {meeting.duration}{" "}
              min
            </span>
          </div>
          {meeting.location && (
            <p>
              {meeting.location.startsWith("https://") ? (
                <a
                  className="day-text-action"
                  href={meeting.location}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir enlace de la reunión ↗
                </a>
              ) : (
                meeting.location
              )}
            </p>
          )}
          <section>
            <h3>Agenda</h3>
            <p className="meeting-prewrap">
              {meeting.agenda || "Agenda por confirmar."}
            </p>
          </section>
          <section>
            <h3>Participantes y asistencia</h3>
            <p className="meeting-muted">
              Registra la participación al comenzar la reunión.
            </p>
            {meeting.participants.map((person) => {
              const enabled =
                meeting.status !== "cancelled" &&
                (admin || person === user?.id) &&
                now >=
                  new Date(
                    `${meeting.date}T${meeting.time}:00-05:00`,
                  ).getTime();
              return (
                <label className="attendance-row" key={person}>
                  <span>
                    {members.data?.find((m) => m.id === person)?.name ??
                      (person === user?.id
                        ? user.name
                        : "Integrante del equipo")}
                  </span>
                  <select
                    aria-label={`Asistencia de ${members.data?.find((m) => m.id === person)?.name ?? "participante"}`}
                    disabled={!enabled}
                    value={meeting.attendance[person] ?? "pending"}
                    onChange={(e) =>
                      save({
                        attendance: {
                          ...meeting.attendance,
                          [person]: e.target.value as Attendance,
                        },
                      })
                    }
                  >
                    <option value="pending">Pendiente</option>
                    <option value="present">Presente</option>
                    <option value="absent">Ausente</option>
                    <option value="excused">Justificado</option>
                  </select>
                </label>
              );
            })}
          </section>
          <section>
            <h3>Acuerdos y próximos pasos</h3>
            {admin ? (
              <>
                <textarea
                  aria-label="Acuerdos y próximos pasos"
                  rows={4}
                  value={notes ?? meeting.minutes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Añade acuerdos, responsables y fechas de entrega"
                />
                <Button
                  variant="secondary"
                  disabled={notes === null}
                  onClick={() => {
                    save({ minutes: notes ?? meeting.minutes });
                    setNotes(null);
                  }}
                >
                  Guardar acuerdos
                </Button>
              </>
            ) : (
              <p className="meeting-prewrap">
                {meeting.minutes ||
                  "Los acuerdos aparecerán al finalizar la reunión."}
              </p>
            )}
          </section>
          {admin && meeting.status === "scheduled" && (
            <div className="meeting-actions">
              <Button onClick={() => save({ status: "completed" })}>
                Finalizar reunión
              </Button>
              <Button
                variant="ghost"
                onClick={() => save({ status: "cancelled" })}
              >
                Cancelar reunión
              </Button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

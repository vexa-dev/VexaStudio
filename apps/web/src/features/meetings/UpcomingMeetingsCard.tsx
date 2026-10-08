import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ArrowUpRight, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { todayLima } from "@vexa/domain/dates";
import {
  useMeetingPlanner,
  useMeetingClock,
  assignedMeetings,
  upcomingMeetings,
  offsetDay,
  meetingDate,
} from "./meeting-planner";
import { MeetingDetail } from "./MeetingDetail";
import "./meetings.css";

export function UpcomingMeetingsCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { meetings } = useMeetingPlanner(user?.id ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const now = useMeetingClock();
  const assigned = assignedMeetings(meetings, user?.id ?? "");
  const items = upcomingMeetings(assigned, now);
  const history = assigned
    .filter((m) => !items.includes(m))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const today = todayLima();
  const nearest = items[0]?.date;
  const visible = items
    .filter((m) => m.date === nearest)
    .slice(0, compact ? 1 : 3);
  const label =
    nearest === today
      ? "Hoy"
      : nearest === offsetDay(today, 1)
        ? "Mañana"
        : nearest
          ? meetingDate(nearest)
          : "Tu agenda";
  return (
    <>
      <Card className="day-meetings-card">
        <div className="day-card-title">
          <h2>
            <CalendarDays size={18} /> Mis reuniones
          </h2>
          <span className="day-plan-count">{label}</span>
        </div>
        {visible.length ? (
          visible.map((m) => (
            <button
              key={m.id}
              className="upcoming-meeting"
              onClick={() => setSelected(m.id)}
            >
              <span className="upcoming-time">
                {m.time}
                <small>{m.duration} min</small>
              </span>
              <span>
                <strong>{m.title}</strong>
                <small>
                  <Clock3 size={12} />{" "}
                  {new Date(`${m.date}T${m.time}:00-05:00`).getTime() <= now
                    ? "En curso"
                    : "Programada"}{" "}
                  · {m.participants.length} participantes
                </small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))
        ) : (
          <p className="day-note">
            Tu agenda está libre. Aquí aparecerán tus próximas reuniones.
          </p>
        )}
        <div className="meeting-actions">
          <Button
            variant="ghost"
            className="day-text-action"
            onClick={() => setAgendaOpen(true)}
          >
            Ver mi agenda <ArrowUpRight size={14} />
          </Button>
          {user?.role === "admin" && (
            <Link to="/reuniones" className="day-text-action">
              Abrir calendario <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
      </Card>
      <Sheet
        open={agendaOpen}
        onClose={() => setAgendaOpen(false)}
        title="Mi agenda"
        description="Tus reuniones y acuerdos · Hora de Lima"
      >
        <div className="meeting-detail">
          {[
            ["Próximas reuniones", items],
            ["Historial", history],
          ].map(([title, entries]) => (
            <section key={String(title)}>
              <h3>{String(title)}</h3>
              {(entries as typeof assigned).length ? (
                (entries as typeof assigned).map((m) => (
                  <button
                    key={m.id}
                    className="meeting-list-item"
                    onClick={() => {
                      setAgendaOpen(false);
                      setSelected(m.id);
                    }}
                  >
                    <span className="meeting-date-block">
                      <strong>{meetingDate(m.date)}</strong>
                      <small>{m.time}</small>
                    </span>
                    <span className="meeting-list-text">
                      <strong>{m.title}</strong>
                      <small>
                        {m.duration} min ·{" "}
                        {m.status === "cancelled"
                          ? "Cancelada"
                          : m.status === "completed"
                            ? "Finalizada"
                            : "Programada"}
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))
              ) : (
                <p className="meeting-muted">
                  No hay reuniones en esta sección.
                </p>
              )}
            </section>
          ))}
        </div>
      </Sheet>
      <MeetingDetail
        key={selected}
        id={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

import { useState } from "react";
import { Navigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  Clock3,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { todayLima } from "@vexa/domain/dates";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMembers } from "@/features/team/hooks/useMembers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { MeetingDetail } from "./MeetingDetail";
import {
  useMeetingPlanner,
  hasMeetingConflict,
  useMeetingClock,
  upcomingMeetings,
  offsetDay,
  meetingDate,
  type PlannedMeeting,
} from "./meeting-planner";
import "./meetings.css";

export default function MeetingsPage() {
  const { user } = useAuth();
  const members = useMembers();
  const { meetings, polls, update } = useMeetingPlanner(user?.id ?? "");
  const today = todayLima();
  const now = useMeetingClock();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);
  const [tab, setTab] = useState("calendar");
  const [selected, setSelected] = useState<string | null>(null);
  const [create, setCreate] = useState<"meeting" | "poll" | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  if (user?.role !== "admin") return <Navigate to="/mi-dia" replace />;
  const people = members.data?.filter((m) => m.active) ?? [user];
  const nameOf = (id: string) =>
    people.find((p) => p.id === id)?.name ?? "Integrante";
  const upcoming = upcomingMeetings(meetings, now);
  const date = new Date(`${month}-01T12:00:00-05:00`);
  const start = offsetDay(`${month}-01`, -((date.getUTCDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => offsetDay(start, i));
  function moveMonth(direction: number) {
    const next = new Date(`${month}-01T12:00:00-05:00`);
    next.setUTCMonth(next.getUTCMonth() + direction);
    const value = todayLima(next);
    setMonth(value.slice(0, 7));
    setDay(value);
  }
  function commit(transform: Parameters<typeof update>[0]) {
    try {
      update(transform);
      toast.success("Cambios guardados");
      return true;
    } catch {
      toast.error("No se pudo guardar. Intenta nuevamente.");
      return false;
    }
  }
  function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const title = String(values.get("title") ?? "").trim();
    const participants = values.getAll("participants").map(String);
    const duration = Number(values.get("duration"));
    const agenda = String(values.get("agenda") ?? "").trim();
    if (!title || !participants.length) {
      setError("Añade un título y al menos un participante.");
      return;
    }
    const options = Array.from(
      { length: create === "poll" ? 3 : 1 },
      (_, i) => ({
        date: String(values.get(`date${i}`)),
        time: String(values.get(`time${i}`)),
        votes: {},
      }),
    );
    if (
      options.some(
        (o) =>
          !o.date ||
          !o.time ||
          new Date(`${o.date}T${o.time}:00-05:00`).getTime() <= Date.now(),
      )
    ) {
      setError("Selecciona horarios futuros para la reunión.");
      return;
    }
    if (
      new Set(options.map((o) => `${o.date} ${o.time}`)).size !== options.length
    ) {
      setError("Elige tres horarios diferentes.");
      return;
    }
    const conflict = options.some((o) =>
      hasMeetingConflict(meetings, o, duration, participants),
    );
    if (conflict) {
      setError(
        "Un participante ya tiene una reunión en ese horario. Elige otro horario.",
      );
      return;
    }
    const success = commit((data) =>
      create === "poll"
        ? {
            ...data,
            polls: [
              ...data.polls,
              {
                id: crypto.randomUUID(),
                title,
                participants,
                duration,
                closed: false,
                options,
              },
            ],
          }
        : {
            ...data,
            meetings: [
              ...data.meetings,
              {
                id: crypto.randomUUID(),
                title,
                participants,
                duration,
                agenda,
                date: options[0].date,
                time: options[0].time,
                location: String(values.get("location") ?? "").trim(),
                minutes: "",
                status: "scheduled",
                attendance: {},
              },
            ],
          },
    );
    if (success) {
      setCreate(null);
      setError("");
    }
  }
  const list = (items: PlannedMeeting[]) =>
    items.length ? (
      items.map((m) => (
        <button
          className="meeting-list-item"
          key={m.id}
          onClick={() => setSelected(m.id)}
        >
          <span className="meeting-date-block">
            <strong>{meetingDate(m.date)}</strong>
            <small>{m.time}</small>
          </span>
          <span className="meeting-list-text">
            <strong>{m.title}</strong>
            <small>
              {m.duration} min · {m.participants.length} participantes
            </small>
          </span>
          <Badge
            tone={
              m.status === "completed"
                ? "success"
                : m.status === "cancelled"
                  ? "danger"
                  : "primary"
            }
          >
            {m.status === "completed"
              ? "Finalizada"
              : m.status === "cancelled"
                ? "Cancelada"
                : "Programada"}
          </Badge>
        </button>
      ))
    ) : (
      <div className="meeting-empty">
        <CalendarDays size={28} />
        <h3>Un espacio libre en tu calendario</h3>
        <p>No hay reuniones en esta selección.</p>
      </div>
    );
  return (
    <div className="meetings-page">
      <header className="quiet-header">
        <div>
          <h1>Reuniones</h1>
          <p className="quiet-caption">
            Encuentra el momento. Alinea al equipo. Da seguimiento.
          </p>
        </div>
        <Button
          onClick={() => {
            setError("");
            setCreate("meeting");
          }}
        >
          <Plus size={16} /> Agendar reunión
        </Button>
      </header>
      <div className="meeting-overview">
        <div>
          <CalendarDays size={19} />
          <span>
            Próximos 7 días
            <strong>
              {upcoming.filter((m) => m.date <= offsetDay(today, 7)).length}{" "}
              reuniones
            </strong>
          </span>
        </div>
        <div>
          <Clock3 size={19} />
          <span>
            Próxima reunión
            <strong>
              {upcoming[0]
                ? `${meetingDate(upcoming[0].date)} · ${upcoming[0].time}`
                : "Agenda libre"}
            </strong>
          </span>
        </div>
        <div>
          <Users size={19} />
          <span>
            Por coordinar
            <strong>
              {polls.filter((p) => !p.closed).length} convocatorias
            </strong>
          </span>
        </div>
      </div>
      <div className="meeting-tabs" aria-label="Vistas de reuniones">
        {[
          ["calendar", "Calendario"],
          ["history", "Historial"],
          ["polls", "Acordar horario"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
        <span>America/Lima · UTC−5</span>
      </div>
      {tab === "calendar" && (
        <div className="meeting-calendar-layout">
          <Card className="meeting-calendar">
            <div className="meeting-calendar-header">
              <h2>
                {new Intl.DateTimeFormat("es-PE", {
                  month: "long",
                  year: "numeric",
                  timeZone: "America/Lima",
                }).format(date)}
              </h2>
              <div>
                <Button
                  variant="ghost"
                  aria-label="Mes anterior"
                  onClick={() => moveMonth(-1)}
                >
                  <ChevronLeft size={18} />
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMonth(today.slice(0, 7));
                    setDay(today);
                  }}
                >
                  Hoy
                </Button>
                <Button
                  variant="ghost"
                  aria-label="Mes siguiente"
                  onClick={() => moveMonth(1)}
                >
                  <ChevronRight size={18} />
                </Button>
              </div>
            </div>
            <div className="calendar-weekdays">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {days.map((d) => {
                const events = meetings.filter(
                  (m) => m.date === d && m.status !== "cancelled",
                );
                return (
                  <button
                    key={d}
                    aria-label={`${meetingDate(d)}, ${events.length} reuniones`}
                    aria-pressed={day === d}
                    className={`calendar-day${d.slice(0, 7) !== month ? " calendar-outside" : ""}${d === today ? " calendar-today" : ""}`}
                    onClick={() => {
                      setDay(d);
                      setMonth(d.slice(0, 7));
                    }}
                  >
                    <span>{Number(d.slice(8))}</span>
                    {events.slice(0, 2).map((m) => (
                      <small key={m.id}>
                        {m.time} {m.title}
                      </small>
                    ))}
                    {events.length > 2 && (
                      <small>+{events.length - 2} más</small>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
          <div className="meeting-agenda">
            <Card>
              <span className="day-eyebrow">Agenda del día</span>
              <h2>{meetingDate(day)}</h2>
              {list(
                meetings
                  .filter((m) => m.date === day)
                  .sort((a, b) => a.time.localeCompare(b.time)),
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  setError("");
                  setCreate("meeting");
                }}
              >
                <Plus size={15} /> Añadir reunión
              </Button>
            </Card>
            <Card>
              <span className="day-eyebrow">En el horizonte</span>
              <h2>Próximas reuniones</h2>
              {list(upcoming.filter((m) => m.date !== day).slice(0, 3))}
            </Card>
          </div>
        </div>
      )}
      {tab === "history" && (
        <Card>
          <div className="meeting-history-toolbar">
            <div>
              <h2>Historial de reuniones</h2>
              <p className="meeting-muted">
                Asistencia, acuerdos y decisiones del equipo.
              </p>
            </div>
            <input
              aria-label="Buscar reunión"
              placeholder="Buscar por título o acuerdo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Filtrar estado"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Finalizadas</option>
              <option value="cancelled">Canceladas</option>
              <option value="scheduled">Programadas</option>
            </select>
          </div>
          {list(
            [...meetings]
              .filter(
                (m) =>
                  (status === "all" || m.status === status) &&
                  `${m.title} ${m.minutes}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .sort((a, b) =>
                `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
              ),
          )}
        </Card>
      )}
      {tab === "polls" && (
        <>
          <div className="meeting-polls-heading">
            <div>
              <h2>Un horario que funcione para todos</h2>
              <p className="meeting-muted">
                Registra la disponibilidad del equipo y confirma la mejor
                opción.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setError("");
                setCreate("poll");
              }}
            >
              <Plus size={16} /> Proponer horarios
            </Button>
          </div>
          <div className="meeting-polls">
            {polls.map((poll) => {
              const counts = poll.options.map(
                (o) =>
                  poll.participants.filter((id) => o.votes[id] === true).length,
              );
              const best = Math.max(...counts);
              return (
                <Card key={poll.id}>
                  <div className="day-card-title">
                    <h2>{poll.title}</h2>
                    <Badge tone={poll.closed ? "success" : "warning"}>
                      {poll.closed ? "Confirmada" : "Por acordar"}
                    </Badge>
                  </div>
                  <p className="meeting-muted">
                    {poll.duration} min · {poll.participants.length}{" "}
                    participantes
                  </p>
                  <div className="poll-options">
                    {poll.options.map((option, index) => (
                      <section
                        key={`${option.date}.${option.time}`}
                        className="poll-option"
                      >
                        <div className="meeting-meta">
                          <strong>
                            {meetingDate(option.date)} · {option.time}
                          </strong>
                          {counts[index] === best && best > 0 && (
                            <Badge tone="primary">Mejor opción</Badge>
                          )}
                        </div>
                        <p className="meeting-muted">
                          {counts[index]} disponibles ·{" "}
                          {
                            poll.participants.filter(
                              (id) => option.votes[id] === false,
                            ).length
                          }{" "}
                          no pueden ·{" "}
                          {
                            poll.participants.filter(
                              (id) => option.votes[id] === undefined,
                            ).length
                          }{" "}
                          pendientes
                        </p>
                        {poll.participants.map((person) => (
                          <label className="attendance-row" key={person}>
                            <span>{nameOf(person)}</span>
                            <select
                              aria-label={`Disponibilidad de ${nameOf(person)} el ${option.date} a las ${option.time}`}
                              disabled={poll.closed}
                              value={
                                option.votes[person] === undefined
                                  ? "pending"
                                  : String(option.votes[person])
                              }
                              onChange={(e) =>
                                commit((data) => ({
                                  ...data,
                                  polls: data.polls.map((p) =>
                                    p.id === poll.id
                                      ? {
                                          ...p,
                                          options: p.options.map((o, i) => {
                                            if (i !== index) return o;
                                            const votes = { ...o.votes };
                                            if (e.target.value === "pending")
                                              delete votes[person];
                                            else
                                              votes[person] =
                                                e.target.value === "true";
                                            return { ...o, votes };
                                          }),
                                        }
                                      : p,
                                  ),
                                }))
                              }
                            >
                              <option value="pending">Sin respuesta</option>
                              <option value="true">Sí puede</option>
                              <option value="false">No puede</option>
                            </select>
                          </label>
                        ))}
                        <Button
                          variant="secondary"
                          disabled={poll.closed || !counts[index]}
                          onClick={() => {
                            const time = new Date(
                              `${option.date}T${option.time}:00-05:00`,
                            ).getTime();
                            if (time <= Date.now()) {
                              toast.error(
                                "Este horario ya pasó. Crea una nueva propuesta.",
                              );
                              return;
                            }
                            if (
                              hasMeetingConflict(
                                meetings,
                                option,
                                poll.duration,
                                poll.participants,
                              )
                            ) {
                              toast.error(
                                "Hay una reunión que coincide con este horario.",
                              );
                              return;
                            }
                            commit((data) => ({
                              ...data,
                              polls: data.polls.map((p) =>
                                p.id === poll.id ? { ...p, closed: true } : p,
                              ),
                              meetings: [
                                ...data.meetings,
                                {
                                  id: crypto.randomUUID(),
                                  title: poll.title,
                                  date: option.date,
                                  time: option.time,
                                  duration: poll.duration,
                                  participants: poll.participants,
                                  location: "",
                                  agenda:
                                    "Revisar avances y acordar próximos pasos.",
                                  minutes: "",
                                  attendance: {},
                                  status: "scheduled",
                                },
                              ],
                            }));
                          }}
                        >
                          <Check size={15} /> Confirmar horario
                        </Button>
                      </section>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
      <MeetingDetail
        key={selected}
        id={selected}
        onClose={() => setSelected(null)}
      />
      <Sheet
        open={create !== null}
        onClose={() => setCreate(null)}
        title={create === "poll" ? "Proponer horarios" : "Agendar reunión"}
        description="Coordina al equipo · Hora de Lima"
      >
        <form
          className="meeting-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
        >
          <label>
            Título
            <input
              name="title"
              required
              maxLength={120}
              placeholder="Ej. Revisión de la propuesta"
            />
          </label>
          <div className="meeting-form-times">
            <label>
              Duración
              <select name="duration" defaultValue="45">
                {[15, 30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {n} minutos
                  </option>
                ))}
              </select>
            </label>
          </div>
          {Array.from({ length: create === "poll" ? 3 : 1 }, (_, i) => (
            <fieldset className="meeting-form-times" key={i}>
              <legend>
                {create === "poll" ? `Opción ${i + 1}` : "Fecha y hora"}
              </legend>
              <label>
                Fecha
                <input
                  type="date"
                  name={`date${i}`}
                  defaultValue={
                    create === "poll"
                      ? offsetDay(today, i + 1)
                      : day < today
                        ? today
                        : day
                  }
                  min={today}
                  required
                />
              </label>
              <label>
                Hora
                <input
                  type="time"
                  name={`time${i}`}
                  defaultValue="16:00"
                  required
                />
              </label>
            </fieldset>
          ))}
          <fieldset>
            <legend>Participantes</legend>
            {members.isError && (
              <p className="meeting-muted">
                No se pudo cargar el equipo.{" "}
                <button type="button" onClick={() => void members.refetch()}>
                  Reintentar
                </button>
              </p>
            )}
            {people.map((p) => (
              <label className="meeting-participant" key={p.id}>
                <input
                  type="checkbox"
                  name="participants"
                  value={p.id}
                  defaultChecked={p.id === user.id}
                />
                {p.name}
                <span>
                  {p.role === "admin"
                    ? "Administrador"
                    : p.role === "partner"
                      ? "Socio"
                      : "Colaborador"}
                </span>
              </label>
            ))}
          </fieldset>
          {create === "meeting" && (
            <>
              <label>
                Enlace o ubicación
                <input
                  name="location"
                  placeholder="https://meet.google.com/… o sala de reuniones"
                  maxLength={300}
                />
              </label>
              <label>
                Agenda
                <textarea
                  name="agenda"
                  rows={3}
                  placeholder="Temas a tratar y objetivo de la reunión"
                  maxLength={3000}
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
          <Button type="submit">
            {create === "poll" ? "Crear convocatoria" : "Agendar reunión"}
          </Button>
        </form>
      </Sheet>
    </div>
  );
}

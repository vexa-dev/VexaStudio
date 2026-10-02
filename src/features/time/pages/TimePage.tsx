import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Play,
  Square,
  Clock3,
  History,
  ChartNoAxesColumn,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, TextareaField } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Sheet } from "@/components/ui/Sheet";
import type { TimeEntry } from "@/domain/types";
import { canEditEntry } from "@/domain/rules";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMembers } from "@/features/team/hooks/useMembers";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { useSettings } from "@/features/settings/hooks/useSettings";
import {
  formatMonthLabel,
  monthKey,
  todayLima,
  formatDate,
  formatDateTime,
} from "@/lib/dates";
import { formatHours, formatClock } from "@/lib/format";
import { EntryFormSheet } from "../components/EntryFormSheet";
import { VoidEntrySheet } from "../components/VoidEntrySheet";
import {
  useActivityTimer,
  useRunningEntry,
  useStopTimer,
  useTimeHistory,
  useReviewTime,
} from "../hooks/useTime";
import { useElapsed } from "../hooks/useElapsed";
import { monthlyActivity } from "../analytics";
import { ChoicePicker, DatePicker } from "../components/TimePickers";
import "./time.css";

const clock = (date: string) =>
  new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
const tabs = [
  { id: "registro", label: "Registro", icon: Clock3 },
  { id: "historial", label: "Historial", icon: History },
  { id: "resumen", label: "Resumen", icon: ChartNoAxesColumn },
  { id: "revision", label: "Revisión", icon: CheckCheck },
];

function ActivityChart({
  values,
  hourly = false,
}: {
  values: number[];
  hourly?: boolean;
}) {
  const max = Math.max(...values, 1);
  return (
    <figure className="hours-chart">
      <figcaption className="sr-only">
        {values
          .map(
            (v, i) =>
              `${hourly ? `${i}:00` : `Día ${i + 1}`}: ${formatHours(v)}`,
          )
          .join("; ")}
      </figcaption>
      {values.map((value, i) => (
        <div
          key={i}
          className="hours-chart-column"
          title={`${hourly ? `${i}:00–${i + 1}:00` : `Día ${i + 1}`}: ${formatHours(value)}`}
        >
          <div className="hours-chart-track">
            <span style={{ height: `${(value / max) * 100}%` }} />
          </div>
          <span>
            {hourly
              ? i % 3 === 0
                ? `${i}h`
                : ""
              : i === 0 || (i + 1) % 5 === 0
                ? i + 1
                : ""}
          </span>
        </div>
      ))}
    </figure>
  );
}

export default function TimePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const selected = tabs.some((t) => t.id === params.get("vista"))
    ? params.get("vista")!
    : "registro";
  const [reference] = useState(() => new Date());
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [state, setState] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry>();
  const [voiding, setVoiding] = useState<TimeEntry | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const history = useTimeHistory();
  const members = useMembers();
  const projects = useProjects();
  const tasks = useTasks();
  const settings = useSettings();
  const running = useRunningEntry();
  const elapsed = useElapsed(running.data?.startedAt);
  const start = useActivityTimer();
  const stop = useStopTimer();
  const review = useReviewTime();
  const mine = (history.data ?? [])
    .filter((e) => e.userId === user?.id)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const statistics = monthlyActivity(mine, month);
  const title = (entry: TimeEntry) =>
    entry.description ||
    tasks.data?.find((t) => t.id === entry.taskId)?.title ||
    "Trabajo del estudio";
  const projectName = (entry: TimeEntry) =>
    projects.data?.find(
      (p) =>
        p.id ===
        (entry.taskId
          ? tasks.data?.find((t) => t.id === entry.taskId)?.projectId
          : entry.projectId),
    )?.name || "Trabajo del estudio";
  const name = (id?: string | null) =>
    members.data?.find((m) => m.id === id)?.name ?? "Socio";
  const status = (e: TimeEntry) =>
    e.voidedAt
      ? "void"
      : !e.endedAt
        ? "running"
        : e.validated
          ? "approved"
          : e.reviewNote
            ? "clarify"
            : "pending";
  const pending = (history.data ?? [])
    .filter(
      (e) =>
        e.userId !== user?.id &&
        e.endedAt &&
        e.hours > 0 &&
        !e.validated &&
        !e.voidedAt,
    )
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const filtered = mine.filter(
    (e) =>
      (!from || todayLima(new Date(e.startedAt)) >= from) &&
      (!to || todayLima(new Date(e.startedAt)) <= to) &&
      (state === "all" || status(e) === state) &&
      `${title(e)} ${projectName(e)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const openForm = (entry?: TimeEntry) => {
    setEditing(entry);
    setFormOpen(true);
  };
  const detail = history.data?.find((e) => e.id === detailId);
  const labels = {
    void: "Anulada",
    running: "En curso",
    approved: "Aprobada",
    clarify: "Por aclarar",
    pending: "Pendiente",
  };
  const openDetail = (entry: TimeEntry) => {
    setDetailId(entry.id);
    setAsking(false);
    setNote("");
  };
  const list = (entries: TimeEntry[], reviewing = false) => (
    <div className="hours-entry-list">
      <div className="hours-table-labels" aria-hidden="true">
        <span>Actividad</span>
        <span>{reviewing ? "Persona / proyecto" : "Proyecto"}</span>
        <span>Fecha / horario</span>
        <span>Estado</span>
        <span>Tiempo</span>
        <span>Acciones</span>
      </div>
      {entries.map((e) => (
        <article className="hours-entry" key={e.id}>
          <button
            type="button"
            className="hours-entry-open"
            aria-label={`Ver detalle: ${title(e)}`}
            onClick={() => openDetail(e)}
          >
            <span className="hours-row-title">
              {title(e)}
              <small>
                {e.source === "timer"
                  ? "Temporizador"
                  : e.source === "manual"
                    ? "Manual"
                    : "Registro anterior"}
                {e.evidenceUrl ? " · Con respaldo" : ""}
              </small>
            </span>
            <span className="hours-row-project">
              {reviewing ? <strong>{name(e.userId)}</strong> : null}
              {projectName(e)}
            </span>
            <span className="hours-row-date">
              {formatDate(e.startedAt)}
              <small>
                {e.source
                  ? `${clock(e.startedAt)}${e.endedAt ? ` – ${clock(e.endedAt)}` : ""}`
                  : "Sin horario"}
              </small>
            </span>
            <span className="hours-row-status">
              <Badge
                tone={
                  e.validated
                    ? "success"
                    : e.voidedAt
                      ? "danger"
                      : e.reviewNote
                        ? "warning"
                        : "neutral"
                }
              >
                {labels[status(e)]}
              </Badge>
            </span>
            <strong className="hours-row-duration num">
              {e.endedAt ? formatHours(e.hours) : "En curso"}
            </strong>
          </button>
          <div className="hours-entry-actions">
            {reviewing ? (
              <Button
                size="sm"
                disabled={review.isPending}
                onClick={() => review.mutate({ id: e.id })}
              >
                Aprobar
              </Button>
            ) : (
              <>
                {e.endedAt &&
                settings.data &&
                canEditEntry(e, reference, settings.data) ? (
                  <Button variant="ghost" size="sm" onClick={() => openForm(e)}>
                    Editar
                  </Button>
                ) : null}
                {!e.voidedAt && !e.validated && e.endedAt ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setVoiding(e)}
                  >
                    Anular
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  );
  return (
    <div className="hours-workspace">
      <header className="hours-page-header">
        <div>
          <h1>Horas</h1>
          <p>Registra tu trabajo y consulta tu avance.</p>
        </div>
        <Button aria-label="Registrar horas" onClick={() => openForm()}>
          <Plus size={18} aria-hidden="true" />
          <span>Registrar horas</span>
        </Button>
      </header>
      <nav className="hours-nav" aria-label="Vistas de horas">
        {tabs
          .filter((t) => t.id !== "revision" || user?.role !== "collaborator")
          .map((t) => (
            <button
              type="button"
              key={t.id}
              aria-current={selected === t.id ? "page" : undefined}
              onClick={() => setParams({ vista: t.id })}
            >
              <t.icon size={16} aria-hidden="true" />
              {t.label}
              {t.id === "revision" && pending.length ? (
                <span>{pending.length}</span>
              ) : null}
            </button>
          ))}
      </nav>
      {history.isLoading ? (
        <Skeleton className="h-64" />
      ) : history.isError ? (
        <ErrorState
          message="No se pudieron cargar las horas."
          onRetry={() => history.refetch()}
        />
      ) : (
        <>
          {selected === "registro" ? (
            <>
              <div className="hours-register-grid">
                <Card
                  className={`hours-timer-card ${running.data ? "is-running" : ""}`}
                >
                  <div className="hours-section-heading">
                    <h2>Tu sesión de trabajo</h2>
                    <Badge>
                      {running.data ? "En curso" : "Lista para empezar"}
                    </Badge>
                  </div>
                  {running.data ? (
                    <>
                      <p
                        className="hours-timer-number num"
                        role="timer"
                        aria-label="Tiempo transcurrido"
                      >
                        {formatClock(elapsed)}
                      </p>
                      <p className="hours-timer-context">
                        {title(running.data)}
                      </p>
                      <Button
                        disabled={stop.isPending}
                        onClick={() => stop.mutate()}
                      >
                        <Square size={15} aria-hidden="true" /> Terminar y
                        guardar
                      </Button>
                    </>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        start.mutate({
                          description,
                          projectId: project || null,
                        });
                      }}
                    >
                      <TextareaField
                        label="¿En qué vas a trabajar?"
                        rows={2}
                        className="hours-auto-textarea"
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        minLength={8}
                        required
                        placeholder="Ej. Preparar la propuesta del estudio"
                      />
                      <ChoicePicker
                        label="Proyecto (opcional)"
                        value={project}
                        onChange={setProject}
                        options={[
                          { value: "", label: "Trabajo del estudio" },
                          ...(projects.data ?? []).map((p) => ({
                            value: p.id,
                            label: p.name,
                          })),
                        ]}
                      />
                      <Button type="submit" disabled={start.isPending}>
                        <Play size={15} aria-hidden="true" /> Iniciar
                        temporizador
                      </Button>
                    </form>
                  )}
                  <p className="hours-help">
                    Al terminar, las horas quedan pendientes de revisión.
                  </p>
                </Card>
                <Card className="hours-manual-card">
                  <div className="hours-manual-heading">
                    <span className="hours-manual-icon">
                      <Plus size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <span className="hours-eyebrow">Sin temporizador</span>
                      <h2>Registra trabajo terminado</h2>
                    </div>
                  </div>
                  <p>
                    Agrega una actividad que ya realizaste. Solo necesitas el
                    horario y un breve resumen.
                  </p>
                  <div className="hours-manual-steps">
                    <span>01 · Fecha y tiempo</span>
                    <span>02 · Qué avanzaste</span>
                    <span>03 · Respaldo opcional</span>
                  </div>
                  <Button variant="secondary" onClick={() => openForm()}>
                    Registrar a mano <Plus size={15} aria-hidden="true" />
                  </Button>
                </Card>
              </div>
              <div className="hours-section-heading">
                <h2>Registros recientes</h2>
                <Button
                  variant="ghost"
                  onClick={() => setParams({ vista: "historial" })}
                >
                  Ver historial
                </Button>
              </div>
              <Card>
                {mine.length ? (
                  list(mine.slice(0, 5))
                ) : (
                  <EmptyState
                    icon={Clock3}
                    title="Tu primer registro empieza aquí"
                    description="Inicia una sesión o registra una actividad que ya terminaste."
                  />
                )}
              </Card>
            </>
          ) : null}
          {selected === "historial" ? (
            <>
              <div className="hours-filters">
                <Field
                  label="Buscar actividad"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <DatePicker
                  label="Desde"
                  value={from}
                  onChange={setFrom}
                  max={to || todayLima(reference)}
                />
                <DatePicker
                  label="Hasta"
                  min={from || undefined}
                  max={todayLima(reference)}
                  value={to}
                  onChange={setTo}
                />
                <ChoicePicker
                  label="Estado"
                  value={state}
                  onChange={setState}
                  options={[
                    { value: "all", label: "Todos" },
                    { value: "pending", label: "Pendiente" },
                    { value: "approved", label: "Aprobada" },
                    { value: "clarify", label: "Por aclarar" },
                    { value: "running", label: "En curso" },
                    { value: "void", label: "Anulada" },
                  ]}
                />
              </div>
              <p className="hours-help">
                {filtered.length} registros ·{" "}
                {formatHours(
                  filtered
                    .filter((e) => !e.voidedAt)
                    .reduce((sum, e) => sum + e.hours, 0),
                )}{" "}
                · Fechas y horarios de Lima
              </p>
              <Card>
                {filtered.length ? (
                  list(filtered)
                ) : (
                  <EmptyState
                    icon={History}
                    title="Sin registros para estos filtros"
                    description="Prueba otro período o estado."
                  />
                )}
              </Card>
            </>
          ) : null}
          {selected === "resumen" ? (
            <>
              <div className="hours-month-heading">
                <h2>{formatMonthLabel(month)}</h2>
                <DatePicker
                  label="Mes"
                  monthOnly
                  max={monthKey(reference)}
                  value={month}
                  onChange={setMonth}
                />
              </div>
              <div className="hours-summary-stats">
                {[
                  {
                    label: "Registradas",
                    value: formatHours(statistics.total),
                  },
                  {
                    label: "Aprobadas",
                    value: formatHours(statistics.approved),
                  },
                  {
                    label: "Sin aprobar",
                    value: formatHours(
                      Math.max(0, statistics.total - statistics.approved),
                    ),
                  },
                  {
                    label: "Días con actividad",
                    value: String(statistics.activeDays),
                  },
                ].map((s) => (
                  <Card key={s.label}>
                    <span>{s.label}</span>
                    <strong className="num">{s.value}</strong>
                  </Card>
                ))}
              </div>
              <div className="hours-charts-grid">
                <Card>
                  <h2>Horas por día</h2>
                  <p className="hours-help">
                    Trabajo registrado durante el mes, sin horas anuladas.
                  </p>
                  <ActivityChart values={statistics.daily} />
                  <details className="hours-chart-data">
                    <summary>Ver datos por día</summary>
                    <ul>
                      {statistics.daily.map((h, i) => (
                        <li key={i}>
                          Día {i + 1}: {formatHours(h)}
                        </li>
                      ))}
                    </ul>
                  </details>
                </Card>
                <Card>
                  <h2>Actividad por horario</h2>
                  <p className="hours-chart-period">
                    {formatMonthLabel(month)}
                  </p>
                  <p className="hours-help">
                    Horas distribuidas por franja en Lima.{" "}
                    {formatHours(statistics.timedHours)} con horario conocido.
                  </p>
                  {statistics.timedHours > 0 ? (
                    <>
                      <ActivityChart
                        key={month}
                        values={statistics.hourly}
                        hourly
                      />
                      <p className="hours-help">
                        Mayor actividad:{" "}
                        {statistics.hourly.indexOf(
                          Math.max(...statistics.hourly),
                        )}
                        :00–
                        {statistics.hourly.indexOf(
                          Math.max(...statistics.hourly),
                        ) + 1}
                        :00.
                      </p>
                      <details className="hours-chart-data">
                        <summary>Ver datos por horario</summary>
                        <ul>
                          {statistics.hourly.map((h, i) => (
                            <li key={i}>
                              {i}:00–{i + 1}:00: {formatHours(h)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </>
                  ) : (
                    <EmptyState
                      icon={ChartNoAxesColumn}
                      title={`Sin horarios en ${formatMonthLabel(month).toLowerCase()}`}
                      description={`${formatHours(statistics.total)} registradas este mes; ${formatHours(Math.max(0, statistics.total - statistics.timedHours))} sin horario conocido. No hay franjas que comparar.`}
                    />
                  )}
                  <p className="hours-help">
                    Los registros antiguos sin horario no se incluyen aquí. El
                    tiempo registrado no equivale a trabajo aprobado.
                  </p>
                </Card>
              </div>
            </>
          ) : null}
          {selected === "revision" && user?.role !== "collaborator" ? (
            <>
              <div className="hours-section-heading">
                <div>
                  <h2>Horas del equipo por revisar</h2>
                  <p className="hours-help">
                    Comprueba el avance y el respaldo. Solo puedes revisar
                    registros de otras personas.
                  </p>
                </div>
              </div>
              <Card>
                {pending.length ? (
                  list(pending, true)
                ) : (
                  <EmptyState
                    icon={CheckCheck}
                    title="Todo revisado"
                    description="No hay horas del equipo pendientes de revisión."
                  />
                )}
              </Card>
            </>
          ) : null}
        </>
      )}
      <EntryFormSheet
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        entry={editing}
      />
      <VoidEntrySheet entry={voiding} onClose={() => setVoiding(null)} />
      <Sheet
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title="Detalle del registro"
      >
        {detail ? (
          <div className="hours-detail">
            <div className="hours-detail-heading">
              <Badge
                tone={
                  detail.validated
                    ? "success"
                    : detail.reviewNote
                      ? "warning"
                      : "neutral"
                }
              >
                {labels[status(detail)]}
              </Badge>
              <strong className="num">{formatHours(detail.hours)}</strong>
            </div>
            <h3>{title(detail)}</h3>
            <dl className="hours-detail-grid">
              <div>
                <dt>Persona</dt>
                <dd>{name(detail.userId)}</dd>
              </div>
              <div>
                <dt>Proyecto</dt>
                <dd>{projectName(detail)}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{formatDate(detail.startedAt)}</dd>
              </div>
              <div>
                <dt>Origen</dt>
                <dd>
                  {detail.source === "timer"
                    ? "Temporizador"
                    : detail.source === "manual"
                      ? "Manual"
                      : "Registro anterior"}
                </dd>
              </div>
              <div>
                <dt>Inicio (Lima)</dt>
                <dd>
                  {detail.source
                    ? formatDateTime(detail.startedAt)
                    : "No informado"}
                </dd>
              </div>
              <div>
                <dt>Fin (Lima)</dt>
                <dd>
                  {detail.source && detail.endedAt
                    ? formatDateTime(detail.endedAt)
                    : detail.endedAt
                      ? "No informado"
                      : "En curso"}
                </dd>
              </div>
              <div>
                <dt>Registrado el</dt>
                <dd>{formatDateTime(detail.createdAt)}</dd>
              </div>
              <div>
                <dt>Tarea</dt>
                <dd>
                  {tasks.data?.find((t) => t.id === detail.taskId)?.title ??
                    "Sin tarea asignada"}
                </dd>
              </div>
            </dl>
            {detail.evidenceUrl && /^https?:\/\//i.test(detail.evidenceUrl) ? (
              <a
                className="hours-evidence"
                href={detail.evidenceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir respaldo ↗
              </a>
            ) : (
              <p className="hours-help">Sin enlace de respaldo.</p>
            )}
            {detail.reviewNote ? (
              <p className="hours-review-note">
                {name(detail.reviewedBy)} pide aclarar: {detail.reviewNote}
              </p>
            ) : null}
            {detail.validatedAt ? (
              <p className="hours-help">
                Aprobado el {formatDateTime(detail.validatedAt)}
                {detail.validatedBy ? ` por ${name(detail.validatedBy)}` : ""}.
              </p>
            ) : null}
            {detail.voidReason ? (
              <p className="hours-help">
                Motivo de anulación: {detail.voidReason}
              </p>
            ) : null}
            {detail.userId !== user?.id &&
            user?.role !== "collaborator" &&
            detail.endedAt &&
            !detail.validated &&
            !detail.voidedAt ? (
              <>
                <div className="hours-detail-actions">
                  <Button
                    disabled={review.isPending}
                    onClick={async () => {
                      try {
                        await review.mutateAsync({ id: detail.id });
                        setDetailId(null);
                      } catch {
                        /* El hook informa el error. */
                      }
                    }}
                  >
                    Aprobar horas
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setAsking(!asking)}
                  >
                    Pedir aclaración
                  </Button>
                </div>
                {asking ? (
                  <form
                    className="hours-clarify-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await review.mutateAsync({ id: detail.id, note });
                        setDetailId(null);
                      } catch {
                        /* El hook muestra el error. */
                      }
                    }}
                  >
                    <TextareaField
                      label="¿Qué necesita aclaración?"
                      minLength={8}
                      required
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                    />
                    <Button type="submit" disabled={review.isPending}>
                      Enviar para aclarar
                    </Button>
                  </form>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

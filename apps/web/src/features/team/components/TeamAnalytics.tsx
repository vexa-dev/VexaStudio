import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import type { Profile, Project, Task, TimeEntry } from "@vexa/domain/types";
import { todayLima, formatIsoDate } from "@vexa/domain/dates";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { memberMetrics } from "../team-model";
const number = (value: number) =>
  new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(value);
export function TeamAnalytics({
  profiles,
  tasks,
  entries,
  projects,
  from,
  onSelect,
}: {
  profiles: Profile[];
  tasks: Task[];
  entries: TimeEntry[];
  projects: Project[];
  from?: string;
  onSelect: (id: string) => void;
}) {
  const [memberPage, setMemberPage] = useState(1);
  const [projectPage, setProjectPage] = useState(1);
  const [sort, setSort] = useState("pending");
  const [projectSearch, setProjectSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const chartRef = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(680);
  const metrics = profiles.map((p) => memberMetrics(p, tasks, entries, from));
  const ids = new Set(profiles.map((p) => p.id));
  const today = todayLima();
  const logged = entries.filter(
    (e) =>
      ids.has(e.userId) &&
      !e.voidedAt &&
      !e.draft &&
      e.endedAt &&
      (!from || e.startedAt.slice(0, 10) >= from) &&
      e.startedAt.slice(0, 10) <= today,
  );
  const hours = logged.reduce((s, e) => s + e.hours, 0);
  const hasHours = logged.length > 0;
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setChartWidth(entry.contentRect.width);
    });
    observer.observe(chart);
    return () => observer.disconnect();
  }, [hasHours]);
  const validated = logged
    .filter((e) => e.validated)
    .reduce((s, e) => s + e.hours, 0);
  const validation = hours ? Math.round((validated / hours) * 100) : 0;
  const start =
    from ?? logged.map((e) => e.startedAt.slice(0, 10)).sort()[0] ?? today;
  const days = Math.max(
    1,
    Math.round(
      (Date.parse(today + "T12:00:00Z") - Date.parse(start + "T12:00:00Z")) /
        86400000,
    ) + 1,
  );
  const bucketSize = Math.max(1, Math.ceil(days / 12));
  const count = Math.ceil(days / bucketSize);
  const series = Array.from({ length: count }, (_, i) => {
    const d = new Date(start + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + i * bucketSize);
    const end = new Date(d);
    end.setUTCDate(end.getUTCDate() + bucketSize - 1);
    const endDate =
      end.toISOString().slice(0, 10) > today
        ? today
        : end.toISOString().slice(0, 10);
    const date = d.toISOString().slice(0, 10);
    const records = logged.filter(
      (e) =>
        e.startedAt.slice(0, 10) >= date && e.startedAt.slice(0, 10) <= endDate,
    );
    return {
      date,
      end: endDate,
      hours: records.reduce((s, e) => s + e.hours, 0),
      validated: records
        .filter((e) => e.validated)
        .reduce((s, e) => s + e.hours, 0),
    };
  });
  const max = Math.max(1, ...series.map((d) => d.hours));
  const x = (i: number) =>
      40 + (i * Math.max(1, chartWidth - 60)) / Math.max(1, count - 1),
    y = (value: number) => 170 - (value / max) * 140;
  const points = series.map((d, i) => `${x(i)},${y(d.hours)}`).join(" ");
  const validatedPoints = series
    .map((d, i) => `${x(i)},${y(d.validated)}`)
    .join(" ");
  const projectHours = new Map<string, number>();
  for (const e of logged) {
    const task = tasks.find((t) => t.id === e.taskId);
    const id = e.projectId ?? task?.projectId ?? "unassigned";
    projectHours.set(id, (projectHours.get(id) ?? 0) + e.hours);
  }
  const projectRows = [
    ...new Set([...projects.map((p) => p.id), ...projectHours.keys()]),
  ]
    .map((id) => ({
      id,
      value: projectHours.get(id) ?? 0,
      name: projects.find((p) => p.id === id)?.name ?? "Sin proyecto",
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .filter((p) =>
      p.name.toLowerCase().includes(projectSearch.toLowerCase().trim()),
    );
  const projectMax = Math.max(1, ...projectRows.map((p) => p.value));
  const workload = [...metrics]
    .filter((m) =>
      m.profile.name.toLowerCase().includes(memberSearch.toLowerCase().trim()),
    )
    .sort(
      (a, b) =>
        (sort === "name"
          ? 0
          : sort === "done"
            ? b.done - a.done
            : b.pending - a.pending) ||
        a.profile.name.localeCompare(b.profile.name),
    );
  const memberPages = Math.max(1, Math.ceil(workload.length / 6));
  const activeMemberPage = Math.min(memberPage, memberPages);
  const memberStart = (activeMemberPage - 1) * 6;
  const shownMembers = workload.slice(memberStart, memberStart + 6);
  const projectPages = Math.max(1, Math.ceil(projectRows.length / 5));
  const activeProjectPage = Math.min(projectPage, projectPages);
  const projectStart = (activeProjectPage - 1) * 5;
  const shownProjects = projectRows.slice(projectStart, projectStart + 5);
  const loadMax = Math.max(1, ...workload.flatMap((m) => [m.pending, m.done]));
  return (
    <div className="team-analytics-layout">
      <div className="team-analytics-top">
        {" "}
        <Card className="team-trend-card">
          <div className="team-section-head">
            <div>
              <p className="eyebrow">EVOLUCIÓN DEL ESFUERZO</p>
              <h2>Horas a lo largo del tiempo</h2>
            </div>
            <div className="team-chart-legend">
              <span>
                <i />
                Registradas
              </span>
              <span>
                <i className="is-secondary" />
                Validadas
              </span>
            </div>
          </div>
          {logged.length ? (
            <>
              <svg
                ref={chartRef}
                className="team-trend"
                viewBox={`0 0 ${chartWidth} 210`}
                role="img"
                aria-label={`Evolución de horas registradas y validadas del ${formatIsoDate(start)} al ${formatIsoDate(today)}`}
              >
                {[0, 0.5, 1].map((f) => (
                  <g key={f}>
                    <line
                      x1="40"
                      x2={chartWidth - 20}
                      y1={y(max * f)}
                      y2={y(max * f)}
                      className="team-trend-grid"
                    />
                    <text x="30" y={y(max * f) + 4} textAnchor="end">
                      {number(max * f)}
                    </text>
                  </g>
                ))}
                <polygon
                  points={`40,170 ${points} ${x(count - 1)},170`}
                  className="team-trend-fill"
                />
                <polyline points={points} className="team-trend-line" />
                <polyline
                  points={validatedPoints}
                  className="team-trend-line is-secondary"
                />
                {series.map((d, i) => (
                  <g key={d.date}>
                    <circle
                      tabIndex={0}
                      cx={x(i)}
                      cy={y(d.hours)}
                      r="5"
                      className="team-trend-dot"
                      data-tooltip={`${formatIsoDate(d.date)}${d.date !== d.end ? " – " + formatIsoDate(d.end) : ""} · ${number(d.hours)} h registradas · ${number(d.validated)} h validadas`}
                      aria-label={`${formatIsoDate(d.date)}: ${number(d.hours)} horas registradas y ${number(d.validated)} validadas`}
                    />
                    {(i === 0 ||
                      i === count - 1 ||
                      i === Math.floor(count / 2)) && (
                      <text x={x(i)} y="195" textAnchor="middle">
                        {formatIsoDate(d.date).slice(0, 5)}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
              <p className="team-caption">
                {bucketSize === 1
                  ? "Totales por día"
                  : `Totales por intervalos de hasta ${bucketSize} días`}{" "}
                · Registros finalizados.
              </p>
            </>
          ) : (
            <p className="team-empty">
              No hay horas registradas en este período.
            </p>
          )}
        </Card>
        <Card className="team-validation-card">
          <div className="team-section-head">
            <div>
              <p className="eyebrow">VALIDACIÓN DE HORAS</p>
              <h2>Horas registradas y validadas</h2>
            </div>
          </div>
          <div className="team-validation">
            <div
              className="team-validation-ring"
              role="img"
              aria-label={`${validation}% de horas validadas`}
              style={{
                background: `conic-gradient(var(--primary-solid) 0 ${hours ? (validated / hours) * 360 : 0}deg, var(--surface-2) ${hours ? (validated / hours) * 360 : 0}deg 360deg)`,
              }}
            >
              <div>
                <strong>{validation}%</strong>
                <span>validadas</span>
              </div>
            </div>
            <dl>
              <div>
                <dt>Validadas</dt>
                <dd>{number(validated)} h</dd>
              </div>
              <div>
                <dt>Sin validar</dt>
                <dd>{number(Math.max(0, hours - validated))} h</dd>
              </div>
              <div>
                <dt>Total registrado</dt>
                <dd>{number(hours)} h</dd>
              </div>
            </dl>
          </div>
          {!hours && (
            <p className="team-caption">
              Sin registros en el período seleccionado.
            </p>
          )}
        </Card>
      </div>
      <div className="team-analytics-bottom">
        <Card className="team-workload-card">
          <div className="team-section-head">
            <div>
              <p className="eyebrow">CARGA POR INTEGRANTE</p>
              <h2>Reparto de tareas</h2>
            </div>
            <ChoicePicker
              label="Ordenar integrantes"
              hideLabel
              value={sort}
              onChange={(value) => {
                setSort(value);
                setMemberPage(1);
              }}
              options={[
                { value: "pending", label: "Más pendientes" },
                { value: "done", label: "Más completadas" },
                { value: "name", label: "Nombre" },
              ]}
            />
          </div>
          <div className="team-workload-toolbar">
            <input
              className="team-chart-search"
              type="search"
              aria-label="Buscar en reparto de tareas"
              placeholder="Buscar integrante…"
              value={memberSearch}
              onChange={(e) => {
                setMemberSearch(e.target.value);
                setMemberPage(1);
              }}
            />
            <div className="team-chart-legend">
              <span>
                <i className="is-secondary" />
                Pendientes
              </span>
              <span>
                <i />
                Completadas
              </span>
            </div>
          </div>
          <div className="team-column-chart">
            <div className="team-column-axis" aria-hidden="true">
              <span>{loadMax}</span>
              <span>{number(loadMax / 2)}</span>
              <span>0</span>
            </div>
            <div
              className="team-column-groups"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, shownMembers.length)}, minmax(0, 1fr))`,
              }}
            >
              {shownMembers.map((m) => (
                <button
                  className="team-column-group"
                  key={m.profile.id}
                  onClick={() => onSelect(m.profile.id)}
                  aria-label={`Ver integrante ${m.profile.name}`}
                  data-tooltip={`${m.profile.name} · ${m.pending} pendientes (${m.todo} por iniciar, ${m.progress} en progreso, ${m.review} en revisión) · ${m.done} completadas`}
                >
                  <span className="team-column-pair">
                    <span
                      className="team-column-bar is-pending"
                      style={{ height: `${(m.pending / loadMax) * 100}%` }}
                    >
                      <span>{m.pending}</span>
                    </span>
                    <span
                      className="team-column-bar"
                      style={{ height: `${(m.done / loadMax) * 100}%` }}
                    >
                      <span>{m.done}</span>
                    </span>
                  </span>
                  <span className="team-column-person">
                    <Avatar name={m.profile.name} size="sm" />
                    <span>{m.profile.name.split(" ")[0]}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          {!shownMembers.length && (
            <p className="team-empty">No hay integrantes con esta búsqueda.</p>
          )}
          <div className="team-chart-pagination">
            <span>
              {workload.length ? memberStart + 1 : 0}–
              {Math.min(memberStart + 6, workload.length)} de {workload.length}{" "}
              integrantes
            </span>
            <div>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Integrantes anteriores"
                disabled={activeMemberPage === 1}
                onClick={() => setMemberPage(activeMemberPage - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Integrantes siguientes"
                disabled={activeMemberPage === memberPages}
                onClick={() => setMemberPage(activeMemberPage + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>{" "}
        <Card className="team-project-card">
          <div className="team-section-head">
            <div>
              <p className="eyebrow">DEDICACIÓN POR PROYECTO</p>
              <h2>Distribución de horas</h2>
            </div>
            <span className="team-caption">{projectRows.length} proyectos</span>
          </div>
          <input
            className="team-chart-search"
            type="search"
            aria-label="Buscar proyecto en el gráfico"
            placeholder="Buscar proyecto…"
            value={projectSearch}
            onChange={(e) => {
              setProjectSearch(e.target.value);
              setProjectPage(1);
            }}
          />
          <div className="team-project-bars">
            {shownProjects.map((p) => (
              <div
                key={p.id}
                data-tooltip={`${p.name} · ${number(p.value)} h · ${hours ? Math.round((p.value / hours) * 100) : 0}% del total`}
              >
                <div>
                  <strong>{p.name}</strong>
                  <span>
                    {number(p.value)} h{" "}
                    <small>
                      · {hours ? Math.round((p.value / hours) * 100) : 0}%
                    </small>
                  </span>
                </div>
                <div className="team-bar-track">
                  <span style={{ width: `${(p.value / projectMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          {!projectRows.length && (
            <p className="team-empty">No hay proyectos con esta búsqueda.</p>
          )}
          <div className="team-chart-pagination">
            <span>
              {projectRows.length ? projectStart + 1 : 0}–
              {Math.min(projectStart + 5, projectRows.length)} de{" "}
              {projectRows.length}
            </span>
            <div>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Proyectos anteriores"
                disabled={activeProjectPage === 1}
                onClick={() => setProjectPage(activeProjectPage - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Proyectos siguientes"
                disabled={activeProjectPage === projectPages}
                onClick={() => setProjectPage(activeProjectPage + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

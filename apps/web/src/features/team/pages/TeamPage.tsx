import {
  ArrowUpRight,
  BarChart3,
  CheckCheck,
  ChevronRight,
  Clock3,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { todayLima, formatIsoDate } from "@vexa/domain/dates";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

import { Sheet } from "@/components/ui/Sheet";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { areaLabel, roleLabel, taskStatusLabel } from "@/lib/labels";
import { useTeamOverview } from "../hooks/useTeamOverview";
import { TeamAnalytics } from "../components/TeamAnalytics";
import { CollaboratorForm } from "../components/CollaboratorForm";
import {
  compensationLabels,
  workModeLabels,
  engagementLabels,
  memberMetrics,
  readCollaborators,
  TEAM_MEMBERS_KEY,
  type LocalCollaborator,
} from "../team-model";
import "./team.css";
const number = (n: number) =>
  new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(n);
const areas = { ...areaLabel, technical: "Tecnología" };
export default function TeamPage() {
  const { data, isPending, error, refetch } = useTeamOverview();
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const [local, setLocal] = useState(readCollaborators);
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("active");
  const [period, setPeriod] = useState("30");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  if (isPending) return <Skeleton className="h-80" />;
  if (error || !data)
    return (
      <ErrorState message={error?.message} onRetry={() => void refetch()} />
    );
  const profiles = [
    ...data.profiles,
    ...local.filter(
      (p) => !data.profiles.some((existing) => existing.id === p.id),
    ),
  ];
  const from =
    period === "all"
      ? undefined
      : (() => {
          const d = new Date(todayLima() + "T12:00:00Z");
          d.setUTCDate(d.getUTCDate() - Number(period) + 1);
          return d.toISOString().slice(0, 10);
        })();
  const metrics = profiles.map((p) =>
    memberMetrics(p, data.tasks, data.entries, from),
  );
  const visible = metrics.filter(
    (m) =>
      (role === "all" || m.profile.role === role) &&
      (status === "all" || m.profile.active === (status === "active")) &&
      (m.profile.name + " " + areas[m.profile.area])
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const displayed = visible.slice(start, start + pageSize);
  const total = visible.reduce((s, m) => s + m.total, 0),
    done = visible.reduce((s, m) => s + m.done, 0),
    hours = visible.reduce((s, m) => s + m.hours, 0);
  const selected = metrics.find((m) => m.profile.id === selectedId);
  const selectedLocal = local.find((p) => p.id === selectedId);
  const daily = data.dailyUpdates
    .filter((d) => visible.some((m) => m.profile.id === d.userId))
    .sort((a, b) => b.date.localeCompare(a.date));
  function saveLocal(next: LocalCollaborator[]) {
    try {
      localStorage.setItem(TEAM_MEMBERS_KEY, JSON.stringify(next));
      setLocal(next);
      return true;
    } catch {
      toast.error("No se pudieron guardar los cambios. Intenta nuevamente.");
      return false;
    }
  }
  function addCollaborator(profile: LocalCollaborator) {
    if (!admin || !saveLocal([...local, profile])) return false;
    setCreate(false);
    setTab("members");
    setRole("all");
    setStatus("all");
    setSearch("");
    setPage(1);
    toast.success("Colaborador registrado");
    return true;
  }
  return (
    <div className="team-workspace">
      <PageHeader
        title="Equipo"
        description="Personas, trabajo y avances del estudio."
        actions={
          admin && (
            <Button
              onClick={() => {
                setCreate(true);
              }}
            >
              <Plus size={16} />
              Agregar colaborador
            </Button>
          )
        }
      />
      <nav className="team-tabs" aria-label="Secciones de equipo">
        {[
          { id: "overview", label: "Resumen", icon: BarChart3 },
          { id: "members", label: "Integrantes", icon: Users },
          { id: "activity", label: "Actividad", icon: Clock3 },
        ].map((t) => (
          <button
            key={t.id}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={16} />
            {t.label}
            {t.id === "members" && <span>{profiles.length}</span>}
          </button>
        ))}
      </nav>
      <div className="team-toolbar">
        <label className="vexa-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar integrante"
            placeholder="Buscar integrante…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="team-filters">
          <ChoicePicker
            label="Período de horas"
            hideLabel
            value={period}
            onChange={setPeriod}
            options={[
              { value: "7", label: "Últimos 7 días" },
              { value: "30", label: "Últimos 30 días" },
              { value: "all", label: "Todo el historial" },
            ]}
          />
          <ChoicePicker
            label="Rol"
            hideLabel
            value={role}
            onChange={(v) => {
              setRole(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Todos los roles" },
              ...Object.entries(roleLabel).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <ChoicePicker
            label="Estado"
            hideLabel
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: "active", label: "Activos" },
              { value: "inactive", label: "Inactivos" },
              { value: "all", label: "Todos los estados" },
            ]}
          />
        </div>
      </div>
      {tab === "overview" && (
        <>
          <div className="team-stats">
            {[
              {
                label: "Integrantes",
                value: visible.length,
                detail: `${visible.filter((m) => m.profile.role === "collaborator").length} ${visible.filter((m) => m.profile.role === "collaborator").length === 1 ? "colaborador" : "colaboradores"}`,
                icon: Users,
              },
              {
                label: "Tareas completadas",
                value: done,
                detail: `${total} asignadas · ${total ? Math.round((done / total) * 100) : 0}% de avance`,
                icon: CheckCheck,
              },
              {
                label: "Trabajo en curso",
                value: visible.reduce((s, m) => s + m.progress + m.review, 0),
                detail: `${visible.reduce((sum, m) => sum + m.review, 0)} en revisión · ${visible.reduce((sum, m) => sum + m.todo, 0)} por iniciar`,
                icon: BarChart3,
              },
              {
                label: "Horas registradas",
                value: number(hours) + " h",
                detail:
                  period === "all"
                    ? "Todo el historial"
                    : `Últimos ${period} días`,
                icon: Clock3,
              },
            ].map((stat) => (
              <Card key={stat.label} className="team-stat">
                <span>
                  <stat.icon size={15} />
                  {stat.label}
                </span>
                <strong className="num">{stat.value}</strong>
                <small>{stat.detail}</small>
              </Card>
            ))}
          </div>
        </>
      )}
      {tab === "overview" && (
        <TeamAnalytics
          key={`${role}-${status}-${search}`}
          profiles={visible.map((m) => m.profile)}
          tasks={data.tasks}
          entries={data.entries}
          projects={data.projects}
          from={from}
          onSelect={setSelectedId}
        />
      )}
      {tab === "members" && (
        <Card className="team-table-card">
          <div className="team-table-wrap">
            <table className="team-table">
              <thead>
                <tr>
                  <th>Integrante</th>
                  <th>Rol / área</th>
                  <th>Estado</th>
                  <th>Tareas</th>
                  <th>Avance</th>
                  <th>Horas</th>
                  <th>
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((m) => (
                  <tr
                    key={m.profile.id}
                    onClick={() => setSelectedId(m.profile.id)}
                  >
                    <td>
                      <button
                        className="team-person"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(m.profile.id);
                        }}
                      >
                        <Avatar name={m.profile.name} src={m.profile.avatarUrl} size="sm" />
                        <span>
                          <strong>{m.profile.name}</strong>
                          <small>
                            {local.find((p) => p.id === m.profile.id)
                              ?.position ||
                              String(m.profile.weeklyHours) + " h por semana"}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      {roleLabel[m.profile.role]}
                      <small>{areas[m.profile.area]}</small>
                    </td>
                    <td>
                      <Badge tone={m.profile.active ? "success" : "neutral"}>
                        {m.profile.active ? "Activo" : "Inactivo"}
                      </Badge>
                      {local.some((p) => p.id === m.profile.id) && (
                        <small>Acceso pendiente</small>
                      )}
                    </td>
                    <td>
                      <strong>
                        {m.done}/{m.total}
                      </strong>
                      <small>{m.pending} pendientes</small>
                    </td>
                    <td>
                      <div className="team-member-progress">
                        <span style={{ width: `${m.completion}%` }} />
                      </div>
                      <small>{m.completion}% completado</small>
                    </td>
                    <td className="num">
                      {number(m.hours)} h
                      <small>{number(m.validatedHours)} h validadas</small>
                    </td>
                    <td>
                      <button
                        aria-label={`Ver integrante ${m.profile.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(m.profile.id);
                        }}
                        className="team-row-open"
                      >
                        <ChevronRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visible.length && (
            <p className="team-empty">No hay integrantes con estos filtros.</p>
          )}
          <div className="team-pagination">
            <div>
              <span>Mostrar</span>
              <ChoicePicker
                label="Integrantes por página"
                hideLabel
                value={String(pageSize)}
                onChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
                options={[10, 20, 50].map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
              />
            </div>
            <span>
              {visible.length ? start + 1 : 0}–
              {Math.min(start + pageSize, visible.length)} de {visible.length}
            </span>
            <div>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Anterior
              </Button>
              <span>
                {currentPage}/{pages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      )}
      {tab === "activity" && (
        <Card>
          <div className="team-section-head">
            <div>
              <p className="eyebrow">ACTUALIZACIONES DEL EQUIPO</p>
              <h2>Avances y bloqueos</h2>
            </div>
            <Link to="/mi-dia" className="team-link">
              Preparar mi daily <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="team-daily-grid">
            {daily.map((d) => (
              <article className="team-daily" key={d.id}>
                <header>
                  <Avatar
                    name={
                      profiles.find((p) => p.id === d.userId)?.name ??
                      "Integrante"
                    }
                    size="sm"
                  />
                  <strong>
                    {profiles.find((p) => p.id === d.userId)?.name}
                  </strong>
                  <small>{formatIsoDate(d.date)}</small>
                </header>
                <dl>
                  <div>
                    <dt>Hice</dt>
                    <dd>{d.done}</dd>
                  </div>
                  <div>
                    <dt>Haré</dt>
                    <dd>{d.willDo}</dd>
                  </div>
                  <div>
                    <dt>Bloqueos</dt>
                    <dd>{d.blockers || "Sin bloqueos"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          {!daily.length && (
            <p className="team-empty">
              No hay actualizaciones de estos integrantes.
            </p>
          )}
        </Card>
      )}
      <Sheet
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.profile.name ?? "Integrante"}
        description={
          selected
            ? `${roleLabel[selected.profile.role]} · ${areas[selected.profile.area]}`
            : undefined
        }
      >
        {selected && (
          <div className="team-member-detail">
            <div className="team-detail-top">
              <Avatar name={selected.profile.name} src={selected.profile.avatarUrl} size="lg" />
              <div>
                <Badge tone={selected.profile.active ? "success" : "neutral"}>
                  {selected.profile.active ? "Activo" : "Inactivo"}
                </Badge>
                <p>{selected.profile.weeklyHours} h de compromiso semanal</p>
                {selectedLocal && (
                  <p>{selectedLocal.email} · Acceso pendiente</p>
                )}
              </div>
            </div>
            <div className="team-detail-metrics">
              <div>
                <strong>
                  {selected.done}/{selected.total}
                </strong>
                <span>Tareas completadas</span>
              </div>
              <div>
                <strong>{number(selected.hours)} h</strong>
                <span>Horas registradas</span>
              </div>
            </div>
            {admin && selectedLocal && (
              <section className="team-employment-detail">
                <h3>Datos y condiciones</h3>
                <dl>
                  {(
                    [
                      ["Cargo", selectedLocal.position],
                      ["Contacto", selectedLocal.phone],
                      [
                        "Responsable",
                        profiles.find(
                          (p) => p.id === selectedLocal.supervisorId,
                        )?.name,
                      ],
                      [
                        "Vínculo",
                        selectedLocal.engagement &&
                          engagementLabels[selectedLocal.engagement],
                      ],
                      [
                        "Modalidad",
                        selectedLocal.workMode &&
                          workModeLabels[selectedLocal.workMode],
                      ],
                      [
                        "Ingreso",
                        selectedLocal.startDate &&
                          formatIsoDate(selectedLocal.startDate),
                      ],
                      [
                        "Término",
                        selectedLocal.startDate
                          ? selectedLocal.endDate
                            ? formatIsoDate(selectedLocal.endDate)
                            : "Sin fecha de término"
                          : undefined,
                      ],
                      [
                        "Remuneración",
                        selectedLocal.compensation &&
                          compensationLabels[selectedLocal.compensation],
                      ],
                      [
                        "Pago acordado",
                        selectedLocal.amount !== undefined
                          ? new Intl.NumberFormat("es-PE", {
                              style: "currency",
                              currency: selectedLocal.currency || "PEN",
                            }).format(selectedLocal.amount)
                          : undefined,
                      ],
                      [
                        "Frecuencia",
                        selectedLocal.paymentFrequency &&
                          {
                            monthly: "Mensual",
                            weekly: "Semanal",
                            project: "Por proyecto",
                          }[selectedLocal.paymentFrequency],
                      ],
                      [
                        "Comisión",
                        selectedLocal.commissionRate !== undefined
                          ? number(selectedLocal.commissionRate) +
                            "% · " +
                            (selectedLocal.commissionBasis || "")
                          : undefined,
                      ],
                    ] as [string, string | undefined][]
                  )
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                </dl>
                {Boolean(selectedLocal.documents?.length) && (
                  <div className="team-document-links">
                    <h3>Documentos</h3>
                    {selectedLocal.documents?.map((document) => (
                      <a
                        key={document.kind}
                        href={document.data}
                        download={document.name}
                      >
                        <span>
                          <strong>
                            {document.kind === "cv" ? "CV" : "Contrato"}
                          </strong>
                          <small>
                            {document.name} · {Math.ceil(document.size / 1024)}{" "}
                            KB
                          </small>
                        </span>
                        <ArrowUpRight size={16} aria-hidden="true" />
                        <span className="sr-only">Descargar</span>
                      </a>
                    ))}
                  </div>
                )}
                {selectedLocal.notes && (
                  <div>
                    <h3>Observaciones</h3>
                    <p className="team-caption team-employment-notes">
                      {selectedLocal.notes}
                    </p>
                  </div>
                )}
              </section>
            )}
            <h3>Tareas asignadas</h3>
            <div className="team-member-tasks">
              {selected.assigned.map((t) => (
                <div key={t.id}>
                  <span>
                    <strong>{t.title}</strong>
                    <small>
                      {data.projects.find((p) => p.id === t.projectId)?.name ??
                        "Sin proyecto"}
                      {t.estimateHours !== null
                        ? ` · ${t.estimateHours} h estimadas`
                        : ""}
                    </small>
                  </span>
                  <Badge tone={t.status === "done" ? "success" : "neutral"}>
                    {taskStatusLabel[t.status]}
                  </Badge>
                </div>
              ))}
              {!selected.total && (
                <p className="team-caption">Aún no tiene tareas asignadas.</p>
              )}
            </div>
            <Link className="team-link" to="/tareas">
              Ver tablero de tareas <ArrowUpRight size={15} />
            </Link>
            {admin && selectedLocal && (
              <Button
                variant="secondary"
                onClick={() => {
                  const next = local.map((p) =>
                    p.id === selectedId ? { ...p, active: !p.active } : p,
                  );
                  if (saveLocal(next)) toast.success("Estado actualizado");
                }}
              >
                {selected.profile.active
                  ? "Desactivar colaborador"
                  : "Reactivar colaborador"}
              </Button>
            )}
          </div>
        )}
      </Sheet>
      <Sheet
        open={create}
        onClose={() => setCreate(false)}
        title="Nuevo colaborador"
        description="Perfil, condiciones y documentación."
        className="team-create-modal"
      >
        {create && (
          <CollaboratorForm
            profiles={profiles}
            existing={local}
            onSave={addCollaborator}
          />
        )}
      </Sheet>
    </div>
  );
}


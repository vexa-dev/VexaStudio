import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  Plus,
  Search,
  Pencil,
  CalendarDays,
  Check,
} from "lucide-react";
import { useDemo } from "../demo";
import { dateLabel, duration, money, totals, type Task } from "../domain";
import {
  Empty,
  PageTitle,
  Panel,
  SectionTitle,
  Status,
} from "../components/UI";
import { ProjectForm, TaskForm, SprintForm } from "../components/Forms";

export default function Projects() {
  const { state, update, notify } = useDemo();
  const [params, setParams] = useSearchParams();
  const selected = state.projects.find((p) => p.id === params.get("proyecto"));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [panel, setPanel] = useState<"new" | "edit" | "task" | "sprint" | null>(
    null,
  );
  const projects = state.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "Todos" || p.status === filter),
  );
  const close = () => setPanel(null);
  return (
    <>
      <PageTitle
        title="Ideas con dirección"
        description="Proyectos, sprints y pequeños pasos hacia algo grande."
      >
        <button className="button primary" onClick={() => setPanel("new")}>
          <Plus size={17} /> Nuevo proyecto
        </button>
      </PageTitle>
      <div className="toolbar">
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Buscar proyectos"
            placeholder="Buscar un proyecto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar proyectos por estado"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>Todos</option>
          <option>Activo</option>
          <option>Pausado</option>
          <option>Completado</option>
        </select>
        <span className="count-label">{projects.length} proyectos</span>
      </div>
      <div className="projects-grid">
        {projects.map((p, i) => {
          const stats = totals(state, p.id);
          const progress = stats.tasks
            ? Math.round((stats.done / stats.tasks) * 100)
            : 0;
          return (
            <button
              className={`project-card surface tone-${i % 3}`}
              key={p.id}
              onClick={() => setParams({ proyecto: p.id })}
            >
              <div className="project-card-top">
                <span className="project-avatar">{p.name[0]}</span>
                <Status value={p.status} />
                <ArrowUpRight size={20} />
              </div>
              <h2>{p.name}</h2>
              <p>{p.description || "Una nueva idea lista para tomar forma."}</p>
              <div className="sprint-label">
                <CalendarDays size={14} />
                {p.sprint.name}
              </div>
              <div className="project-progress">
                <span>
                  {stats.done} / {stats.tasks} tareas
                </span>
                <strong>{progress}%</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="project-card-bottom">
                <span>{duration(stats.minutes)}</span>
                <span>{money(stats.expenses)}</span>
              </div>
            </button>
          );
        })}
      </div>
      {!projects.length && (
        <Empty
          title={state.projects.length ? "Nada en esta órbita" : undefined}
        >
          {state.projects.length
            ? "Prueba con otro nombre o cambia el filtro."
            : undefined}
        </Empty>
      )}
      {selected && !panel && (
        <Panel title={selected.name} onClose={() => setParams({})}>
          <div className="detail-intro">
            <Status value={selected.status} />
            <p>{selected.description}</p>
            <button
              className="button secondary"
              onClick={() => setPanel("edit")}
            >
              <Pencil size={15} /> Editar proyecto
            </button>
          </div>
          <SectionTitle title={selected.sprint.name}>
            <button className="text-link" onClick={() => setPanel("sprint")}>
              Editar sprint
            </button>
          </SectionTitle>
          <p className="subtle date-range">
            {dateLabel(selected.sprint.start)} —{" "}
            {dateLabel(selected.sprint.end)}
          </p>
          <SectionTitle title="Tareas">
            <button className="text-link" onClick={() => setPanel("task")}>
              <Plus size={16} /> Añadir
            </button>
          </SectionTitle>
          <div className="task-list">
            {state.tasks
              .filter((t) => t.projectId === selected.id)
              .map((t) => (
                <div className="task-row" key={t.id}>
                  <span
                    className={`task-indicator ${t.status === "Completada" ? "completed" : ""}`}
                  >
                    {t.status === "Completada" && <Check size={13} />}
                  </span>
                  <strong>{t.title}</strong>
                  <select
                    aria-label={`Estado de ${t.title}`}
                    value={t.status}
                    onChange={(e) => {
                      const status = e.target.value as Task["status"];
                      update((s) => ({
                        ...s,
                        tasks: s.tasks.map((task) =>
                          task.id === t.id ? { ...task, status } : task,
                        ),
                      }));
                      notify("Estado de tarea actualizado.");
                    }}
                  >
                    <option>Pendiente</option>
                    <option>En curso</option>
                    <option>Completada</option>
                  </select>
                </div>
              ))}
          </div>
          {!state.tasks.some((t) => t.projectId === selected.id) && (
            <Empty title="El primer paso está por escribir">
              Añade una tarea para comenzar este sprint.
            </Empty>
          )}
        </Panel>
      )}
      {panel && (
        <Panel
          title={
            panel === "new"
              ? "Nuevo proyecto"
              : panel === "edit"
                ? "Editar proyecto"
                : panel === "sprint"
                  ? "Editar sprint"
                  : "Nueva tarea"
          }
          onClose={close}
        >
          {panel === "new" || panel === "edit" ? (
            <ProjectForm
              project={panel === "edit" ? selected : undefined}
              onDone={close}
            />
          ) : (
            selected &&
            (panel === "task" ? (
              <TaskForm projectId={selected.id} onDone={close} />
            ) : (
              <SprintForm project={selected} onDone={close} />
            ))
          )}
        </Panel>
      )}
    </>
  );
}

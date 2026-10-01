import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus, Clock3, ArrowRight } from "lucide-react";
import { useDemo, useTotals } from "../demo";
import { duration, money } from "../domain";
import { Empty, PageTitle, SectionTitle, Status } from "../components/UI";

const Core = lazy(() => import("../components/Core3D"));
export default function Overview({ effects }: { effects: boolean }) {
  const { state } = useDemo();
  const stats = useTotals();
  const progress = stats.tasks
    ? Math.round((stats.done / stats.tasks) * 100)
    : 0;
  return (
    <>
      <PageTitle
        title="Todo empieza aquí"
        description="Un poco de perspectiva. Mucho por construir."
      />
      <section className="observatory glass" aria-label="Panorama del trabajo">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="observatory-copy">
          <h2>
            Ideas en órbita.
            <br />
            <span>Trabajo en foco.</span>
          </h2>
          <p>
            Conecta lo que imaginas con lo que haces.
            <br />
            Este es el pulso de tu estudio.
          </p>
          <Link className="button primary" to="/proyectos">
            Explorar proyectos <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="core-stage">
          <Suspense
            fallback={<div className="core-loading">Cargando cristal…</div>}
          >
            <Core effects={effects} />
          </Suspense>
          <span className="core-caption">VEXA · OBSERVATORIO</span>
        </div>
        <div className="hero-bottom">
          <span>Un espacio compartido para crear.</span>
          <span>
            Diseñado para avanzar <ArrowRight size={14} />
          </span>
        </div>
      </section>
      <section className="pulse-strip" aria-label="Totales de la demo">
        <div>
          <span>Proyectos activos</span>
          <strong>
            {state.projects
              .filter((p) => p.status === "Activo")
              .length.toString()
              .padStart(2, "0")}
          </strong>
        </div>
        <div>
          <span>Tareas completadas</span>
          <strong>
            {stats.done}
            <small> / {stats.tasks}</small>
          </strong>
        </div>
        <div>
          <span>Tiempo registrado</span>
          <strong>{duration(stats.minutes)}</strong>
        </div>
        <div>
          <span>Inversión registrada</span>
          <strong>{money(stats.expenses)}</strong>
        </div>
      </section>
      <div className="overview-columns">
        <section>
          <SectionTitle title="En el radar">
            <Link className="text-link" to="/proyectos">
              Todos los proyectos <ArrowUpRight size={15} />
            </Link>
          </SectionTitle>
          <div className="project-list surface">
            {!state.projects.length && <Empty />}
            {state.projects.slice(0, 3).map((p, i) => {
              const tasks = state.tasks.filter((t) => t.projectId === p.id);
              const done = tasks.filter(
                (t) => t.status === "Completada",
              ).length;
              return (
                <Link
                  to={`/proyectos?proyecto=${p.id}`}
                  className="radar-row"
                  key={p.id}
                >
                  <span className={`project-avatar tone-${i % 3}`}>
                    {p.name.slice(0, 1)}
                  </span>
                  <div className="radar-info">
                    <strong>{p.name}</strong>
                    <span>{p.sprint.name}</span>
                  </div>
                  <div className="radar-state">
                    <Status value={p.status} />
                    <small>
                      {done} de {tasks.length} tareas
                    </small>
                  </div>
                  <ArrowUpRight size={18} />
                </Link>
              );
            })}
          </div>
        </section>
        <section>
          <SectionTitle title="El siguiente paso" />
          <div className="focus-panel surface">
            <div className="focus-title">
              <span>Avance del trabajo</span>
              <strong>{progress}%</strong>
            </div>
            <progress
              className="native-progress"
              aria-label="Tareas completadas"
              value={progress}
              max={100}
            >
              {progress}%
            </progress>
            <p>
              {stats.tasks
                ? `${stats.tasks - stats.done} tareas por completar. Cada pequeño avance cuenta.`
                : "Tu próximo proyecto comienza con una idea."}
            </p>
            <Link to="/proyectos" className="quick-link">
              <Plus size={17} />
              <span>Dar forma a una idea</span>
              <ArrowUpRight size={16} />
            </Link>
            <Link to="/horas" className="quick-link">
              <Clock3 size={17} />
              <span>Entrar en modo foco</span>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

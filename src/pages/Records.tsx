import { useState } from "react";
import { Plus, Pencil, Search, Wallet, Clock3 } from "lucide-react";
import { useDemo } from "../demo";
import { dateLabel, duration, money, type Hour, type Expense } from "../domain";
import { Empty, PageTitle, Panel, SectionTitle } from "../components/UI";
import { RecordForm } from "../components/Forms";
import { Timer } from "../components/Timer";

export default function Records({ kind }: { kind: "hour" | "expense" }) {
  const { state } = useDemo();
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("all");
  const [panel, setPanel] = useState(false);
  const [editing, setEditing] = useState<Hour | Expense | undefined>();
  const hours = kind === "hour";
  const rows = (hours ? state.hours : state.expenses)
    .filter(
      (r) =>
        (project === "all" || r.projectId === project) &&
        r.description.toLowerCase().includes(query.toLowerCase()),
    )
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const sum = rows.reduce(
    (total, r) =>
      total + ("minutes" in r ? r.minutes : Math.round(r.amount * 100)),
    0,
  );
  return (
    <>
      <PageTitle
        title={hours ? "Tu tiempo tiene valor" : "Cada recurso cuenta"}
        description={
          hours
            ? "Registra el trabajo. Encuentra tu ritmo."
            : "Una mirada clara a lo que inviertes en tus proyectos."
        }
      >
        <button
          className="button primary"
          onClick={() => {
            setEditing(undefined);
            setPanel(true);
          }}
          disabled={!state.projects.length}
        >
          <Plus size={17} />
          {hours ? "Registrar horas" : "Añadir gasto"}
        </button>
      </PageTitle>
      {hours && <Timer />}
      <section className="record-summary surface">
        <span className="summary-icon">
          {hours ? <Clock3 size={24} /> : <Wallet size={24} />}
        </span>
        <div>
          <span className="subtle">
            {hours ? "Tiempo registrado" : "Inversión registrada"} · selección
            actual
          </span>
          <strong>{hours ? duration(sum) : money(sum / 100)}</strong>
        </div>
        <span className="record-count">
          {rows.length} registros{" "}
          <span>Datos de ejemplo y tus cambios locales</span>
        </span>
      </section>
      <SectionTitle title={hours ? "Diario de trabajo" : "Movimientos"} />
      <div className="toolbar">
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label={hours ? "Buscar registros de horas" : "Buscar gastos"}
            placeholder="Buscar por descripción"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar registros por proyecto"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="all">Todos los proyectos</option>
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <p className="table-hint">Desliza la tabla para ver todos los detalles.</p>
      <section className="table-wrap surface" tabIndex={0} aria-label={hours ? 'Tabla de horas, desplazamiento horizontal disponible' : 'Tabla de gastos, desplazamiento horizontal disponible'}>
        {rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Proyecto</th>
                <th>Fecha</th>
                {!hours && <th>Categoría</th>}
                <th className="align-right">
                  {hours ? "Duración" : "Importe"}
                </th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.description}</strong>
                  </td>
                  <td>
                    {state.projects.find((p) => p.id === r.projectId)?.name}
                  </td>
                  <td className="nowrap">{dateLabel(r.date)}</td>
                  {"category" in r && (
                    <td>
                      <span className="category-tag">{r.category}</span>
                    </td>
                  )}
                  <td className="align-right numeric">
                    {"minutes" in r ? duration(r.minutes) : money(r.amount)}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Editar ${r.description}`}
                      onClick={() => {
                        setEditing(r);
                        setPanel(true);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="Aquí comienza tu registro">
            {state.projects.length
              ? "Añade un registro o cambia los filtros para ver tu trabajo."
              : "Crea tu primer proyecto antes de registrar horas o gastos."}
          </Empty>
        )}
      </section>
      {panel && (
        <Panel
          title={
            editing
              ? hours
                ? "Editar horas"
                : "Editar gasto"
              : hours
                ? "Registrar horas"
                : "Nuevo gasto"
          }
          onClose={() => setPanel(false)}
        >
          <RecordForm
            kind={kind}
            hour={editing && "minutes" in editing ? editing : undefined}
            expense={editing && "amount" in editing ? editing : undefined}
            onDone={() => setPanel(false)}
          />
        </Panel>
      )}
    </>
  );
}

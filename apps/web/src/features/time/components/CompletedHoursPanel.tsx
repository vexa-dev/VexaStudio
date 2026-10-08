import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckCheck, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Sheet } from "@/components/ui/Sheet";
import { formatIsoDate, todayLima } from "@vexa/domain/dates";
import { useHoursDrafts, useSubmitDrafts } from "../hooks/useTime";

function sessionDuration(hours: number) {
  const seconds = Number.isFinite(hours)
    ? Math.max(0, Math.round(hours * 3600))
    : 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return (
    [h && `${h} h`, m && `${m} min`, s && `${s} s`].filter(Boolean).join(" ") ||
    "0 min"
  );
}

export function CompletedHoursPanel() {
  const drafts = useHoursDrafts();
  const submit = useSubmitDrafts();
  const formId = useId();
  const [values, setValues] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(todayLima());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const chosen = (drafts.data ?? []).filter((d) => selected.includes(d.id));
  const value = (id: string, fallback: number) =>
    values[id] ??
    (fallback ? String(Math.round(fallback * 10000) / 10000) : "");
  const total = chosen.reduce(
    (sum, d) => sum + (Number(value(d.id, d.hours)) || 0),
    0,
  );
  return (
    <Card className="hours-completed-panel">
      <div className="hours-section-heading">
        <div>
          <h2>
            <Clock3 size={17} aria-hidden="true" /> Pendientes de registrar
          </h2>
          <p className="hours-help">
            Revisa tus sesiones y confirma las horas trabajadas.
          </p>
        </div>
        {Boolean(drafts.data?.length) && (
          <span className="hours-draft-count num">
            {drafts.data?.length} por registrar
          </span>
        )}
      </div>
      {drafts.isLoading ? (
        <Skeleton className="h-32" />
      ) : drafts.isError ? (
        <ErrorState
          message="No se pudieron cargar los borradores."
          onRetry={() => drafts.refetch()}
        />
      ) : !drafts.data?.length ? (
        <EmptyState
          icon={CheckCheck}
          title="Todo registrado"
          description="Termina tareas o finaliza una sesión desde tu tablero para preparar sus horas aquí."
          action={
            <Link to="/tareas">
              <Button variant="secondary">Ir a mis tareas</Button>
            </Link>
          }
        />
      ) : (
        <form
          id={formId}
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              submit.isPending ||
              !chosen.length ||
              !Number.isFinite(total) ||
              total <= 0 ||
              total > 24 ||
              chosen.some(
                (d) =>
                  !Number.isFinite(Number(value(d.id, d.hours))) ||
                  Number(value(d.id, d.hours)) <= 0,
              )
            )
              return;
            if (!confirmOpen) {
              setConfirmOpen(true);
              return;
            }
            try {
              await submit.mutateAsync({
                items: chosen.map((d) => ({
                  id: d.id,
                  hours:
                    values[d.id] === undefined ? d.hours : Number(values[d.id]),
                })),
                date,
                description: "",
                participants: [],
              });
              setSelected([]);
              setValues({});
              setConfirmOpen(false);
            } catch {
              /* Keep draft edits on failure. */
            }
          }}
        >
          <div className="hours-draft-list-heading">
            <button
              type="button"
              disabled={submit.isPending}
              onClick={() => {
                setSelected(
                  chosen.length === drafts.data.length
                    ? []
                    : drafts.data.map((draft) => draft.id),
                );
                if (!selected.length) setDate(drafts.data[0].date);
              }}
            >
              {chosen.length === drafts.data.length
                ? "Quitar selección"
                : "Seleccionar todas"}
            </button>
            <span>Horas trabajadas</span>
          </div>
          <div className="hours-draft-list">
            {drafts.data.map((d) => (
              <div
                key={d.id}
                className="hours-draft-row"
                data-selected={selected.includes(d.id) || undefined}
              >
                <label aria-label={`Seleccionar ${d.title}`}>
                  <input
                    className="hours-session-select-input"
                    type="checkbox"
                    disabled={submit.isPending}
                    checked={selected.includes(d.id)}
                    onChange={(e) => {
                      setSelected(
                        e.target.checked
                          ? [...selected, d.id]
                          : selected.filter((id) => id !== d.id),
                      );
                      if (!selected.length) setDate(d.date);
                    }}
                  />
                  <span className="hours-session-select" aria-hidden="true">
                    <Check size={12} />
                  </span>
                  <span>
                    <strong>{d.title}</strong>
                    <small>
                      {formatIsoDate(d.date).slice(0, 5)} ·{" "}
                      {d.measured
                        ? "Tiempo medido"
                        : d.hours
                          ? "Estimación sugerida · editable"
                          : "Indica el tiempo real"}
                    </small>
                  </span>
                </label>
                <div className="hours-draft-time hours-session-edit">
                  <Field
                    label={`Horas: ${d.title}`}
                    aria-label={`Horas: ${d.title}`}
                    type="number"
                    min="0.0001"
                    max="24"
                    step="any"
                    inputMode="decimal"
                    disabled={submit.isPending}
                    value={value(d.id, d.hours)}
                    onChange={(e) =>
                      setValues({ ...values, [d.id]: e.target.value })
                    }
                  />
                  <span aria-hidden="true">h</span>
                </div>
              </div>
            ))}
          </div>
        </form>
      )}
      {Boolean(drafts.data?.length) && (
        <div className="hours-draft-overview">
          <div>
            <span>
              {chosen.length
                ? `${chosen.length} seleccionadas`
                : "Tiempo por confirmar"}
            </span>
            <strong className="num">
              {sessionDuration(
                chosen.length
                  ? total
                  : (drafts.data ?? []).reduce(
                      (sum, draft) =>
                        sum + (Number(value(draft.id, draft.hours)) || 0),
                      0,
                    ),
              )}
            </strong>
          </div>
          <Button
            size="sm"
            type="submit"
            form={formId}
            disabled={
              submit.isPending ||
              !chosen.length ||
              total <= 0 ||
              total > 24 ||
              chosen.some(
                (d) =>
                  !Number.isFinite(Number(value(d.id, d.hours))) ||
                  Number(value(d.id, d.hours)) <= 0,
              )
            }
          >
            {submit.isPending ? "Registrando…" : "Registrar horas"}{" "}
            <CheckCheck size={14} aria-hidden="true" />
          </Button>
        </div>
      )}
      <Sheet
        open={confirmOpen && chosen.length > 0}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar registro de horas"
        description="Estas actividades se registrarán y quedarán pendientes de revisión."
        className="hours-registration-confirm"
      >
        <div className="hours-confirm-date">
          <span>Fecha de registro</span>
          <strong>{formatIsoDate(date)}</strong>
        </div>
        <ul className="hours-confirm-items">
          {chosen.map((draft) => (
            <li key={draft.id}>
              <span>{draft.title}</span>
              <strong className="num">{value(draft.id, draft.hours)} h</strong>
            </li>
          ))}
        </ul>
        <div className="hours-confirm-total">
          <span>
            Total · {chosen.length}{" "}
            {chosen.length === 1 ? "actividad" : "actividades"}
          </span>
          <strong className="num">{Number(total.toFixed(4))} h</strong>
          <small>{sessionDuration(total)}</small>
        </div>
        <div className="hours-confirm-actions">
          <Button
            variant="ghost"
            disabled={submit.isPending}
            onClick={() => setConfirmOpen(false)}
          >
            Volver a editar
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={submit.isPending || !chosen.length}
          >
            <CheckCheck size={16} aria-hidden="true" />
            {submit.isPending ? "Registrando…" : "Confirmar registro"}
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

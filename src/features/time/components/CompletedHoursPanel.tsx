import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, TextareaField } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { todayLima } from "@/lib/dates";
import { formatHours } from "@/lib/format";
import { useHoursDrafts, useSubmitDrafts } from "../hooks/useTime";
import { DatePicker } from "./TimePickers";

export function CompletedHoursPanel() {
  const drafts = useHoursDrafts();
  const submit = useSubmitDrafts();
  const [values, setValues] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayLima());
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
          <h2>Pendientes de registrar</h2>
          <p className="hours-help">
            Tareas terminadas y sesiones medidas. Selecciona varias y confirma
            el tiempo real.
          </p>
        </div>
        <CheckCheck size={20} className="text-primary-text" />
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
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await submit.mutateAsync({
                items: chosen.map((d) => ({
                  id: d.id,
                  hours:
                    values[d.id] === undefined ? d.hours : Number(values[d.id]),
                })),
                date,
                description,
              });
              setSelected([]);
              setValues({});
              setDescription("");
            } catch {
              /* Keep draft edits on failure. */
            }
          }}
        >
          <div className="hours-draft-list">
            {drafts.data.map((d) => (
              <div key={d.id} className="hours-draft-row">
                <label aria-label={`Seleccionar ${d.title}`}>
                  <input
                    type="checkbox"
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
                  <span>
                    <strong>{d.title}</strong>
                    <small>
                      {d.measured
                        ? "Tiempo medido"
                        : d.hours
                          ? "Estimación sugerida · editable"
                          : "Indica el tiempo real"}
                    </small>
                  </span>
                </label>
                <Field
                  label={`Horas: ${d.title}`}
                  aria-label={`Horas: ${d.title}`}
                  type="number"
                  min="0.0001"
                  max="24"
                  step="any"
                  inputMode="decimal"
                  value={value(d.id, d.hours)}
                  onChange={(e) =>
                    setValues({ ...values, [d.id]: e.target.value })
                  }
                />
              </div>
            ))}
          </div>
          {chosen.length > 0 && (
            <div className="hours-draft-confirm">
              <div className="hours-section-heading">
                <strong className="num">
                  {chosen.length} tareas · Total: {formatHours(total)}
                </strong>
                <span className="text-xs text-muted">
                  Se registra una sola vez
                </span>
              </div>
              <Field
                label="Tiempo total (h)"
                type="number"
                step="any"
                min="0.0001"
                max="24"
                inputMode="decimal"
                value={Number(total.toFixed(4)) || ""}
                onChange={(e) => {
                  const amount = Number(e.target.value);
                  if (!Number.isFinite(amount)) return;
                  const next = { ...values };
                  let assigned = 0;
                  chosen.forEach((d, index) => {
                    const weight =
                      total > 0
                        ? (Number(value(d.id, d.hours)) || 0) / total
                        : 1 / chosen.length;
                    const hours =
                      index === chosen.length - 1
                        ? amount - assigned
                        : Math.round(amount * weight * 10000) / 10000;
                    next[d.id] = String(Math.max(0, Number(hours.toFixed(4))));
                    assigned += hours;
                  });
                  setValues(next);
                }}
              />
              <p className="hours-help">
                El total se reparte entre las tareas seleccionadas. Puedes
                ajustar cada una arriba.
              </p>
              <DatePicker
                label="Fecha de trabajo"
                value={date}
                onChange={setDate}
                max={todayLima()}
              />
              <TextareaField
                label="Avance adicional (opcional)"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Se incluirán los nombres de las tareas si lo dejas vacío."
              />
              <Button
                type="submit"
                disabled={
                  submit.isPending ||
                  total <= 0 ||
                  total > 24 ||
                  chosen.some((d) => Number(value(d.id, d.hours)) <= 0)
                }
              >
                Confirmar y enviar a revisión
              </Button>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}

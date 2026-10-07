import { CheckCheck, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import {
  closeEligibility,
  eligibleEntryIds,
} from "@vexa/domain/sprint-close";
import { formatDate } from "@vexa/domain/dates";
import { formatHours } from "@vexa/domain/format";
import type { Id, Sprint, SprintCloseEntry } from "@vexa/domain/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Meter } from "@/components/ui/Meter";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMembers } from "@/features/team/hooks/useMembers";
import { useCloseSprint, useSprintCloseReport } from "../hooks/useSprintClose";

interface CloseSprintSheetProps {
  open: boolean;
  onClose: () => void;
  sprint: Sprint;
  /** Quien abre la hoja; las horas propias y en las que está etiquetado no se pueden validar. */
  viewerId: Id;
  /** Solo el admin cierra; con `false` (o con un sprint ya cerrado) la hoja es de consulta. */
  canClose: boolean;
}

export function CloseSprintSheet({
  open,
  onClose,
  sprint,
  viewerId,
  canClose,
}: CloseSprintSheetProps) {
  const closed = sprint.status === "closed";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={closed ? "Sprint cerrado" : "Cerrar sprint"}
      description={sprint.goal}
      className="sm:max-w-2xl"
    >
      <CloseSprintContent
        sprint={sprint}
        viewerId={viewerId}
        canClose={canClose && !closed}
        onDone={onClose}
      />
    </Sheet>
  );
}

function CloseSprintContent({
  sprint,
  viewerId,
  canClose,
  onDone,
}: {
  sprint: Sprint;
  viewerId: Id;
  canClose: boolean;
  onDone: () => void;
}) {
  const report = useSprintCloseReport(sprint.id, true);
  const members = useMembers();
  const close = useCloseSprint();
  const [selected, setSelected] = useState<Id[]>([]);
  const [confirming, setConfirming] = useState(false);

  const nameOf = (id: Id | null) =>
    id === null
      ? "Sin responsable"
      : (members.data?.find((m) => m.id === id)?.name ?? "Persona");

  const pending = useMemo(
    () => report.data?.pendingEntries ?? [],
    [report.data],
  );
  const eligible = useMemo(
    () => eligibleEntryIds(pending, viewerId),
    [pending, viewerId],
  );
  const byPerson = useMemo(() => {
    const groups = new Map<Id, SprintCloseEntry[]>();
    for (const entry of pending)
      groups.set(entry.userId, [...(groups.get(entry.userId) ?? []), entry]);
    return [...groups.entries()];
  }, [pending]);

  if (report.isLoading || members.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (report.isError || !report.data) {
    return (
      <ErrorState
        message="No se pudo cargar el reporte del sprint."
        onRetry={() => void report.refetch()}
      />
    );
  }

  const { partners } = report.data;
  const committed = partners.reduce((n, p) => n + p.committed, 0);
  const delivered = partners.reduce((n, p) => n + p.delivered, 0);
  const toBacklog = committed - delivered;
  const allSelected =
    eligible.length > 0 && eligible.every((id) => selected.includes(id));
  const toggle = (id: Id, on: boolean) =>
    setSelected((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)));
  const selectedHours = pending
    .filter((e) => selected.includes(e.id))
    .reduce((n, e) => n + e.hoursInSprint, 0);

  const confirm = async () => {
    try {
      await close.mutateAsync({ sprintId: sprint.id, entryIds: selected });
      onDone();
    } catch {
      // El aviso de error lo muestra el hook; la hoja queda abierta para reintentar.
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="close-delivery" className="flex flex-col gap-3">
        <h3 id="close-delivery" className="text-sm font-semibold">
          Entregado vs comprometido
        </h3>
        {partners.length === 0 ? (
          <p className="text-sm text-muted">
            Este sprint no tuvo tareas ni horas registradas.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {partners.map((p) => (
              <li
                key={p.userId ?? "none"}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium">{nameOf(p.userId)}</span>
                  <span className="num text-sm text-muted">
                    <span className="font-semibold text-fg">{p.delivered}</span>{" "}
                    de {p.committed} tareas entregadas
                  </span>
                </div>
                <Meter
                  value={p.delivered}
                  max={Math.max(p.committed, 1)}
                  label={`${nameOf(p.userId)}: ${p.delivered} de ${p.committed} tareas entregadas`}
                  className="h-2"
                  animate={false}
                />
                <p className="num text-sm text-muted">
                  Horas: {formatHours(p.loggedHours)} registradas de{" "}
                  {formatHours(p.estimatedHours)} estimadas
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="close-hours" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="close-hours" className="text-sm font-semibold">
            Horas pendientes de validar
          </h3>
          {canClose && eligible.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelected(allSelected ? [] : eligible)}
            >
              <CheckCheck className="size-4" aria-hidden="true" />
              {allSelected ? "Quitar selección" : "Validar todo lo elegible"}
            </Button>
          )}
        </div>
        {pending.length === 0 ? (
          <EmptyState
            icon={CheckCheck}
            title="No hay horas pendientes"
            description="Todas las horas de este sprint ya están revisadas."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {!canClose && (
              <p className="text-sm text-muted">
                Estas horas siguen pendientes. Se revisan desde Horas, o con una
                solicitud de aclaración si hay una objeción.
              </p>
            )}
            {byPerson.map(([userId, entries]) => (
              <fieldset key={userId} className="flex flex-col gap-1">
                <legend className="mb-1 flex w-full items-baseline justify-between gap-2 text-sm font-medium">
                  <span>{nameOf(userId)}</span>
                  <span className="num text-muted">
                    {formatHours(
                      entries.reduce((n, e) => n + e.hoursInSprint, 0),
                    )}
                  </span>
                </legend>
                {entries.map((entry) => {
                  const rule = closeEligibility(entry, viewerId);
                  const disabled = !canClose || !rule.eligible;
                  return (
                    <label
                      key={entry.id}
                      className="flex min-h-11 items-start gap-3 rounded-lg px-1 py-2"
                    >
                      {canClose && (
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={selected.includes(entry.id)}
                          onChange={(e) => toggle(entry.id, e.target.checked)}
                          className="mt-0.5 size-4 accent-primary"
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm">
                          {entry.description || "Registro de horas"}
                        </span>
                        <span className="num text-xs text-muted">
                          {formatDate(entry.startedAt)} ·{" "}
                          {formatHours(entry.hoursInSprint)}
                          {entry.clarificationRequested
                            ? " · Aclaración solicitada"
                            : ""}
                        </span>
                        {canClose && !rule.eligible && (
                          <span className="text-xs text-warning">
                            No puedes validarla: {rule.reason.toLowerCase()}.
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            ))}
          </div>
        )}
      </section>

      {canClose && !confirming && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
          <Button onClick={() => setConfirming(true)}>
            <Lock className="size-4" aria-hidden="true" />
            Cerrar sprint…
          </Button>
        </div>
      )}

      {canClose && confirming && (
        <div
          role="alertdialog"
          aria-labelledby="close-confirm"
          className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary-soft p-4"
        >
          <h3 id="close-confirm" className="font-semibold">
            ¿Cerrar este sprint?
          </h3>
          <ul className="num list-disc pl-5 text-sm">
            <li>
              {selected.length} registro{selected.length === 1 ? "" : "s"} de
              horas ({formatHours(selectedHours)}) se validan y quedan bloqueados
              para edición.
            </li>
            <li>
              {pending.length - selected.length} registro
              {pending.length - selected.length === 1 ? "" : "s"} quedan
              pendientes.
            </li>
            <li>
              {toBacklog} tarea{toBacklog === 1 ? "" : "s"} sin terminar
              {toBacklog === 1 ? " vuelve" : " vuelven"} al backlog.
            </li>
          </ul>
          <p className="text-sm text-muted">Esta acción no se puede deshacer.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              disabled={close.isPending}
              onClick={() => setConfirming(false)}
            >
              Volver
            </Button>
            <Button disabled={close.isPending} onClick={() => void confirm()}>
              {close.isPending ? "Cerrando…" : "Confirmar cierre"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

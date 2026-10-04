import { ChevronDown, History } from "lucide-react";
import { useState } from "react";
import type { AuditEntity, AuditLogEntry } from "@vexa/domain/audit";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useEntityTimeline } from "../hooks/useActivity";
import { ActivityDetailSheet } from "./ActivityDetailSheet";
import { ActivityTimeline } from "./ActivityTimeline";

type EntityRef = Pick<AuditEntity, "table" | "id">;

/** Historial de un registro (tarea, horas...), con el mismo detalle que la pantalla de Actividad. */
export function EntityHistory({ table, id }: EntityRef) {
  const timeline = useEntityTimeline(table, id);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  if (timeline.isPending)
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando historial">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  if (timeline.isError)
    return (
      <ErrorState
        title="No se pudo cargar el historial"
        message={timeline.error.message}
        onRetry={() => void timeline.refetch()}
      />
    );
  if (timeline.data.length === 0)
    return (
      <p className="text-sm text-muted">Este registro aún no tiene historial.</p>
    );
  return (
    <>
      <ActivityTimeline entries={timeline.data} onSelect={setSelected} />
      <ActivityDetailSheet entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/** Botón "Ver historial" que despliega el historial del registro; no consulta nada hasta abrirse. */
export function EntityHistoryToggle({ table, id }: EntityRef) {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-3" aria-label="Historial">
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <History className="size-4" aria-hidden="true" />
        {open ? "Ocultar historial" : "Ver historial"}
        <ChevronDown
          className={`size-4 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </Button>
      {open ? <EntityHistory table={table} id={id} /> : null}
    </section>
  );
}

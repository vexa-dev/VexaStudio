import { History } from "lucide-react";
import { useMemo, useState } from "react";
import type { AuditLogEntry } from "@vexa/domain/audit";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFirstPlay } from "@/lib/useFirstPlay";
import { ActivityDetailSheet } from "../components/ActivityDetailSheet";
import { ActivityFilters } from "../components/ActivityFilters";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { useActivityFeed } from "../hooks/useActivity";
import { useActivityRealtime } from "../hooks/useActivityRealtime";
import {
  EMPTY_FILTERS,
  toAuditFilter,
  type ActivityFilterState,
} from "../lib/filter-state";

/** Registro de actividad del estudio: quién hizo qué y cuándo, para admin y socios. */
export default function ActivityPage() {
  const [filters, setFilters] = useState<ActivityFilterState>(EMPTY_FILTERS);
  const [touched, setTouched] = useState(false);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const firstVisit = useFirstPlay("activity");
  useActivityRealtime();
  const feed = useActivityFeed(useMemo(() => toAuditFilter(filters), [filters]));
  const entries = feed.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader
        title="Actividad"
        description="Quién hizo qué y cuándo, con la hora exacta de Lima."
      />
      <ActivityFilters
        value={filters}
        onChange={(next) => {
          setTouched(true);
          setFilters(next);
        }}
      />
      {feed.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando actividad">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : feed.isError ? (
        <ErrorState
          title="No se pudo cargar la actividad"
          message={feed.error.message}
          onRetry={() => void feed.refetch()}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin actividad con estos filtros"
          description="Cuando alguien edite tareas, horas o proyectos, aparecerá aquí."
        />
      ) : (
        <>
          <ActivityTimeline
            entries={entries}
            onSelect={setSelected}
            animate={firstVisit && !touched}
          />
          {feed.hasNextPage ? (
            <div className="mt-5 flex justify-center">
              <Button
                variant="secondary"
                disabled={feed.isFetchingNextPage}
                onClick={() => void feed.fetchNextPage()}
              >
                {feed.isFetchingNextPage ? "Cargando…" : "Cargar más"}
              </Button>
            </div>
          ) : null}
        </>
      )}
      <ActivityDetailSheet entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}

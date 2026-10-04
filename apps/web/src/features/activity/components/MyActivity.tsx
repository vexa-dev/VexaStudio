import { History } from "lucide-react";
import { useState } from "react";
import type { AuditLogEntry } from "@vexa/domain/audit";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useActivityFeed } from "../hooks/useActivity";
import { ActivityDetailSheet } from "./ActivityDetailSheet";
import { ActivityTimeline } from "./ActivityTimeline";

const STEP = 8;

/** "Mi actividad": lo más reciente que hizo la persona, para el perfil de cualquier rol. */
export function MyActivity({ userId }: { userId: string }) {
  const feed = useActivityFeed({ actorId: userId });
  const [visible, setVisible] = useState(STEP);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const entries = feed.data?.pages.flatMap((page) => page.items) ?? [];
  const more = entries.length > visible || feed.hasNextPage;

  return (
    <Card className="mt-6 flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold">Mi actividad</h2>
      {feed.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando actividad">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : feed.isError ? (
        <ErrorState
          title="No se pudo cargar tu actividad"
          message={feed.error.message}
          onRetry={() => void feed.refetch()}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="Aún no tienes actividad"
          description="Tus acciones en tareas, horas y proyectos aparecerán aquí."
        />
      ) : (
        <>
          <ActivityTimeline
            entries={entries.slice(0, visible)}
            onSelect={setSelected}
          />
          {more ? (
            <Button
              variant="secondary"
              className="self-center"
              disabled={feed.isFetchingNextPage}
              onClick={() => {
                setVisible(visible + STEP);
                if (entries.length < visible + STEP && feed.hasNextPage)
                  void feed.fetchNextPage();
              }}
            >
              {feed.isFetchingNextPage ? "Cargando…" : "Ver más"}
            </Button>
          ) : null}
        </>
      )}
      <ActivityDetailSheet entry={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}

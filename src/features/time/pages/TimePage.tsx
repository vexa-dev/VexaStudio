import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Meter } from "@/components/ui/Meter";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { canEditEntry } from "@/domain/rules";
import type { TimeEntry } from "@/domain/types";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import {
  formatDate,
  formatDayHeading,
  todayLima,
  weekRange,
} from "@/lib/dates";
import { formatHours } from "@/lib/format";
import { useFirstPlay } from "@/lib/useFirstPlay";
import { stagger } from "@/lib/utils";
import { EntryFormSheet } from "../components/EntryFormSheet";
import { VoidEntrySheet } from "../components/VoidEntrySheet";
import { useEntries } from "../hooks/useTime";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function TimePage() {
  const { user } = useAuth();
  const [reference] = useState(() => Date.now());
  const [weekOffset, setWeekOffset] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | undefined>();
  const [voiding, setVoiding] = useState<TimeEntry | null>(null);
  const animate = useFirstPlay("time");

  const week = useMemo(
    () => weekRange(new Date(reference + weekOffset * WEEK_MS)),
    [reference, weekOffset],
  );
  const entries = useEntries(
    { from: week.start.toISOString(), to: week.end.toISOString() },
    user?.id,
  );
  const tasks = useTasks();
  const projects = useProjects();
  const settings = useSettings();

  const taskTitle = (id: string) =>
    tasks.data?.find((t) => t.id === id)?.title ?? "Tarea";
  const projectOfTask = (id: string) => {
    const projectId = tasks.data?.find((t) => t.id === id)?.projectId;
    return projects.data?.find((p) => p.id === projectId)?.name ?? "";
  };

  const days = useMemo(() => {
    const groups = new Map<string, TimeEntry[]>();
    for (const entry of [...(entries.data ?? [])].sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    )) {
      const key = todayLima(new Date(entry.startedAt));
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.entries()];
  }, [entries.data]);

  const total = (entries.data ?? [])
    .filter((e) => !e.voidedAt)
    .reduce((sum, e) => sum + e.hours, 0);
  const commitment = user?.weeklyHours ?? 0;
  const isCurrentWeek = weekOffset === 0;

  const openNew = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (entry: TimeEntry) => {
    setEditing(entry);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Horas"
        description="Tus horas de la semana, con el temporizador o registradas a mano."
        actions={
          <Button onClick={openNew}>
            <Plus className="size-4" aria-hidden="true" />
            Registrar horas
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Button
          variant="secondary"
          className="w-11 px-0"
          aria-label="Semana anterior"
          onClick={() => setWeekOffset((v) => v - 1)}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Button>
        <p className="num text-center text-sm font-medium">
          {isCurrentWeek ? "Esta semana · " : ""}
          {formatDate(week.start)} al {formatDate(week.end)}
        </p>
        <Button
          variant="secondary"
          className="w-11 px-0"
          aria-label="Semana siguiente"
          disabled={isCurrentWeek}
          onClick={() => setWeekOffset((v) => Math.min(v + 1, 0))}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </Button>
      </div>

      {entries.isLoading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-28" />
          <Skeleton className="h-48" />
        </div>
      ) : entries.isError ? (
        <ErrorState
          message="No se pudieron cargar tus horas."
          onRetry={() => entries.refetch()}
        />
      ) : (
        <div className="time-overview flex flex-col gap-4">
          <Card className="enter flex flex-col gap-3" style={stagger(1)}>
            <p className="text-sm">
              <span className="num text-2xl font-bold">
                {formatHours(total)}
              </span>{" "}
              <span className="text-muted">
                de {formatHours(commitment)} comprometidas{" "}
                {isCurrentWeek ? "esta semana" : "esa semana"}
              </span>
            </p>
            <Meter
              value={total}
              max={Math.max(commitment * 1.25, total, 1)}
              threshold={commitment}
              label={`${formatHours(total)} de ${formatHours(commitment)} comprometidas`}
              animate={animate}
            />
          </Card>

          {days.length === 0 ? (
            <EmptyState
              icon={Clock}
              title={
                isCurrentWeek
                  ? "Aún no registras horas esta semana"
                  : "No registraste horas esa semana"
              }
              description="Inicia el temporizador desde una tarea o registra las horas a mano."
              action={
                <Button onClick={openNew}>
                  <Plus className="size-4" aria-hidden="true" />
                  Registrar horas
                </Button>
              }
            />
          ) : (
            days.map(([day, dayEntries], index) => (
              <section
                key={day}
                aria-label={formatDayHeading(dayEntries[0].startedAt)}
                className="enter"
                style={stagger(index + 2)}
              >
                <h2 className="mb-2 px-1 text-sm font-semibold text-muted">
                  {formatDayHeading(dayEntries[0].startedAt)}
                </h2>
                <Card className="p-0 sm:p-0">
                  <ul className="divide-y divide-border">
                    {dayEntries.map((entry) => {
                      const voided = Boolean(entry.voidedAt);
                      const running = entry.endedAt === null && !voided;
                      const editable =
                        !running && settings.data
                          ? canEditEntry(
                              entry,
                              new Date(reference),
                              settings.data,
                            )
                          : false;
                      return (
                        <li
                          key={entry.id}
                          className="flex items-center gap-2 px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className={`line-clamp-2 text-sm font-medium ${voided ? "text-muted line-through" : ""}`}
                            >
                              {taskTitle(entry.taskId)}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="truncate text-xs text-muted">
                                {projectOfTask(entry.taskId)}
                              </span>
                              {running ? (
                                <Badge tone="primary">En curso</Badge>
                              ) : null}
                              {entry.validated ? (
                                <Badge tone="success">Validada</Badge>
                              ) : null}
                              {entry.paid ? <Badge>Pagada</Badge> : null}
                              {voided ? (
                                <Badge tone="danger">Anulada</Badge>
                              ) : null}
                            </div>
                            {voided && entry.voidReason ? (
                              <p className="mt-1 text-xs text-muted">
                                Motivo: {entry.voidReason}
                              </p>
                            ) : null}
                          </div>
                          <span className="num text-sm font-semibold">
                            {running ? "—" : formatHours(entry.hours)}
                          </span>
                          {editable && !voided ? (
                            <div className="flex">
                              <Button
                                variant="ghost"
                                className="w-11 px-0"
                                aria-label={`Editar el registro de ${taskTitle(entry.taskId)}`}
                                onClick={() => openEdit(entry)}
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="ghost"
                                className="w-11 px-0"
                                aria-label={`Anular el registro de ${taskTitle(entry.taskId)}`}
                                onClick={() => setVoiding(entry)}
                              >
                                <Ban className="size-4" aria-hidden="true" />
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </section>
            ))
          )}
        </div>
      )}

      <EntryFormSheet
        open={formOpen}
        entry={editing}
        onClose={() => setFormOpen(false)}
      />
      <VoidEntrySheet entry={voiding} onClose={() => setVoiding(null)} />
    </>
  );
}

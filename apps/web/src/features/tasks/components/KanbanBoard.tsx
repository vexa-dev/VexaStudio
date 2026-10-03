import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { useState, type KeyboardEvent } from "react";
import type { Profile, Task, TaskStatus } from "@vexa/domain/types";
import { taskStatusLabel } from "@/lib/labels";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn, stagger } from "@/lib/utils";
import { DragHandle, TaskCard } from "./TaskCard";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "review", "done"];

export interface KanbanBoardProps {
  tasks: Task[];
  members: Profile[];
  currentUserId: string;
  runningTaskId: string | null;
  readOnly?: boolean;
  allowTimer?: boolean;
  projectNames?: Record<string, string>;
  busy?: boolean;
  onOpen: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
  onStart: (task: Task) => void;
  onStop: () => void;
}

/** Con el puntero manda la posición del cursor; con el teclado (sin cursor) manda el cruce de rectángulos. */
const detectColumn: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args);
  return byPointer.length > 0 ? byPointer : rectIntersection(args);
};

/** Con el teclado, las flechas izquierda y derecha saltan de columna en columna (no hay orden dentro de cada una). */
const columnCoordinates: KeyboardCoordinateGetter = (
  event,
  { context: { droppableRects, collisionRect } },
) => {
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft")
    return undefined;
  event.preventDefault();
  if (!collisionRect) return undefined;
  const centerX = collisionRect.left + collisionRect.width / 2;
  const columns = STATUSES.map((status) => droppableRects.get(status)).filter(
    (rect) => rect !== undefined,
  );
  const current = columns.findIndex(
    (rect) => centerX >= rect.left && centerX <= rect.right,
  );
  const target = columns[current + (event.code === "ArrowRight" ? 1 : -1)];
  return target ? { x: target.left + 16, y: target.top + 56 } : undefined;
};

/** Textos para lectores de pantalla durante el arrastre, en español. */
const announcements = (tasks: Task[]): Announcements => {
  const title = (id: string | number) =>
    tasks.find((t) => t.id === id)?.title ?? "la tarea";
  const column = (id: string | number | undefined) =>
    id && id in taskStatusLabel
      ? taskStatusLabel[id as TaskStatus]
      : "una posición sin columna";
  return {
    onDragStart: ({ active }) => `Tomaste «${title(active.id)}».`,
    onDragOver: ({ active, over }) =>
      `«${title(active.id)}» está sobre ${column(over?.id)}.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Soltaste «${title(active.id)}» en ${column(over.id)}.`
        : `«${title(active.id)}» volvió a su lugar.`,
    onDragCancel: ({ active }) =>
      `Cancelaste el movimiento de «${title(active.id)}».`,
  };
};

function DraggableCard(props: KanbanBoardProps & { task: Task }) {
  const {
    task,
    members,
    currentUserId,
    runningTaskId,
    busy,
    onOpen,
    onMove,
    onStart,
    onStop,
  } = props;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: props.readOnly,
  });
  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <TaskCard
        task={task}
        assignee={members.find((m) => m.id === task.assigneeId)}
        readOnly={props.readOnly}
        projectName={
          props.projectNames?.[task.projectId ?? ""] ??
          (task.projectId ? "Tarea de proyecto" : "Sin proyecto")
        }
        canTrack={
          props.allowTimer !== false && task.assigneeId === currentUserId
        }
        isTracking={runningTaskId === task.id}
        busy={busy}
        handle={
          props.readOnly ? undefined : (
            <DragHandle {...attributes} {...listeners} />
          )
        }
        onOpen={onOpen}
        onMove={onMove}
        onStart={onStart}
        onStop={onStop}
      />
    </div>
  );
}

function Column({
  status,
  ...props
}: KanbanBoardProps & { status: TaskStatus }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const tasks = props.tasks.filter((t) => t.status === status);
  return (
    <section
      ref={setNodeRef}
      aria-label={`${taskStatusLabel[status]}, ${tasks.length} tareas`}
      className={cn(
        "flex min-h-48 flex-col gap-3 rounded-xl border p-3 transition-colors duration-150",
        isOver
          ? "border-primary bg-primary-soft"
          : "border-border bg-surface-2/50",
      )}
    >
      <h3 className="flex items-center justify-between px-1 text-sm font-semibold">
        {taskStatusLabel[status]}
        <span className="num text-xs font-medium text-muted">
          {tasks.length}
        </span>
      </h3>
      {tasks.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-muted">
          {props.readOnly ? "Sin tareas" : "Suelta aquí una tarea"}
        </p>
      ) : (
        tasks.map((task) => (
          <DraggableCard key={task.id} {...props} task={task} />
        ))
      )}
    </section>
  );
}

function DesktopBoard(props: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }),
  );
  const active = props.tasks.find((t) => t.id === activeId);

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    setActiveId(null);
    const task = props.tasks.find((t) => t.id === dragged.id);
    if (task && over && STATUSES.includes(over.id as TaskStatus))
      props.onMove(task, over.id as TaskStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectColumn}
      accessibility={{
        announcements: announcements(props.tasks),
        screenReaderInstructions: {
          draggable:
            "Para mover la tarea, pulsa Espacio, usa las flechas para elegir la columna y pulsa Espacio otra vez para soltarla. Escape cancela.",
        },
      }}
      onDragStart={({ active: a }: DragStartEvent) => setActiveId(String(a.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid auto-cols-[minmax(16rem,1fr)] grid-flow-col items-start gap-3 overflow-x-auto pb-2">
        {STATUSES.map((status, i) => (
          <div key={status} className="enter" style={stagger(i)}>
            <Column status={status} {...props} />
          </div>
        ))}
      </div>
      <DragOverlay>
        {active ? (
          <TaskCard
            task={active}
            assignee={props.members.find((m) => m.id === active.assigneeId)}
            canTrack={false}
            isTracking={false}
            dragging
            onOpen={() => {}}
            onMove={() => {}}
            onStart={() => {}}
            onStop={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** En el celular se muestra una columna a la vez; cambiar de columna es un selector "Mover a" en cada tarjeta. */
function MobileBoard(props: KanbanBoardProps) {
  const [selected, setSelected] = useState<TaskStatus>(() =>
    props.tasks.some((t) => t.status === "in_progress")
      ? "in_progress"
      : "todo",
  );
  const visible = props.tasks.filter((t) => t.status === selected);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = STATUSES.indexOf(selected);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setSelected(STATUSES[(next + STATUSES.length) % STATUSES.length]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Columnas del tablero"
        onKeyDown={onKeyDown}
        className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1"
      >
        {STATUSES.map((status) => {
          const count = props.tasks.filter((t) => t.status === status).length;
          const isSelected = status === selected;
          return (
            <button
              key={status}
              type="button"
              role="tab"
              id={`tab-${status}`}
              aria-selected={isSelected}
              aria-controls="board-panel"
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelected(status)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center rounded-lg px-1 text-xs font-medium",
                isSelected
                  ? "bg-surface font-semibold text-fg shadow-card"
                  : "text-muted",
              )}
            >
              <span className="truncate">{taskStatusLabel[status]}</span>
              <span className="num text-sm font-semibold">{count}</span>
            </button>
          );
        })}
      </div>
      <div
        id="board-panel"
        role="tabpanel"
        aria-labelledby={`tab-${selected}`}
        className="flex flex-col gap-3"
      >
        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            No hay tareas en «{taskStatusLabel[selected]}».
          </p>
        ) : (
          visible.map((task, i) => (
            <div key={task.id} className="enter" style={stagger(i)}>
              <TaskCard
                task={task}
                assignee={props.members.find((m) => m.id === task.assigneeId)}
                readOnly={props.readOnly}
                projectName={
                  props.projectNames?.[task.projectId ?? ""] ??
                  (task.projectId ? "Tarea de proyecto" : "Sin proyecto")
                }
                canTrack={
                  props.allowTimer !== false &&
                  task.assigneeId === props.currentUserId
                }
                isTracking={props.runningTaskId === task.id}
                busy={props.busy}
                onOpen={props.onOpen}
                onMove={props.onMove}
                onStart={props.onStart}
                onStop={props.onStop}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function KanbanBoard(props: KanbanBoardProps) {
  const isDesktop = useMediaQuery("(min-width: 64rem)");
  return isDesktop ? <DesktopBoard {...props} /> : <MobileBoard {...props} />;
}

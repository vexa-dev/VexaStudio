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
import { useEffect, useState, type KeyboardEvent } from "react";
import { todayLima, weekRange } from "@vexa/domain/dates";
import {
  CalendarDays,
  CircleCheck,
  ClipboardCheck,
  ListTodo,
  Timer,
} from "lucide-react";
import type { Profile, Task, TaskStatus } from "@vexa/domain/types";
import { taskStatusLabel } from "@/lib/labels";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn, stagger } from "@/lib/utils";
import { DragHandle, TaskCard } from "./TaskCard";
import "./kanban.css";

type BoardColumn = TaskStatus | "week";
const STATUSES: BoardColumn[] = [
  "todo",
  "week",
  "in_progress",
  "review",
  "done",
];
const columnLabel: Record<BoardColumn, string> = {
  ...taskStatusLabel,
  todo: "Tareas",
  week: "Esta semana",
};
const COLUMN_DETAILS = {
  todo: { icon: ListTodo, description: "Por planificar" },
  week: { icon: CalendarDays, description: "Pendientes de esta semana" },
  in_progress: { icon: Timer, description: "Trabajo activo" },
  review: { icon: ClipboardCheck, description: "Para validar" },
  done: { icon: CircleCheck, description: "Trabajo completado" },
};

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

interface BoardProps extends KanbanBoardProps {
  columnFor: (task: Task) => BoardColumn;
  onColumnMove: (task: Task, column: BoardColumn) => void;
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
    id && id in columnLabel
      ? columnLabel[id as BoardColumn]
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

function DraggableCard(props: BoardProps & { task: Task }) {
  const {
    task,
    members,
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
        showMoveControl={false}
        projectName={
          props.projectNames?.[task.projectId ?? ""] ??
          (task.projectId ? "Tarea de proyecto" : "Sin proyecto")
        }
        canTrack={false}
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

function Column({ status, ...props }: BoardProps & { status: BoardColumn }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const tasks = props.tasks.filter((t) => props.columnFor(t) === status);
  const Icon = COLUMN_DETAILS[status].icon;
  return (
    <section
      ref={setNodeRef}
      aria-label={`${columnLabel[status]}, ${tasks.length} tareas`}
      data-status={status}
      className={cn("kanban-column", isOver && "kanban-column-over")}
    >
      <div className="kanban-column-header">
        <div className="kanban-column-heading">
          <Icon size={16} aria-hidden="true" />
          <h3>{columnLabel[status]}</h3>
          <span className="num kanban-column-count">{tasks.length}</span>
        </div>
        <p>{COLUMN_DETAILS[status].description}</p>
      </div>
      <div
        className="kanban-column-scroll"
        role="region"
        aria-label={`Lista de ${columnLabel[status].toLowerCase()}`}
        tabIndex={0}
      >
        {tasks.length === 0 ? (
          <p className="kanban-empty">
            {props.readOnly ? "Sin tareas" : "Suelta aquí una tarea"}
          </p>
        ) : (
          tasks.map((task) => (
            <DraggableCard key={task.id} {...props} task={task} />
          ))
        )}
      </div>
    </section>
  );
}

function DesktopBoard(props: BoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }),
  );
  const active = props.tasks.find((t) => t.id === activeId);

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    setActiveId(null);
    const task = props.tasks.find((t) => t.id === dragged.id);
    if (task && over && STATUSES.includes(over.id as BoardColumn))
      props.onColumnMove(task, over.id as BoardColumn);
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
      <div className="kanban-board">
        {STATUSES.map((status, i) => (
          <div
            key={status}
            className="kanban-column-slot enter"
            style={stagger(i)}
          >
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
            showMoveControl={false}
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
function MobileBoard(props: BoardProps) {
  const [selected, setSelected] = useState<BoardColumn>(() =>
    props.tasks.some((t) => t.status === "in_progress")
      ? "in_progress"
      : "todo",
  );
  const visible = props.tasks.filter((t) => props.columnFor(t) === selected);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = STATUSES.indexOf(selected);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setSelected(STATUSES[(next + STATUSES.length) % STATUSES.length]);
  };

  return (
    <div className="kanban-mobile">
      <div
        role="tablist"
        aria-label="Columnas del tablero"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1"
      >
        {STATUSES.map((status) => {
          const count = props.tasks.filter(
            (t) => props.columnFor(t) === status,
          ).length;
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
                "flex min-h-12 min-w-20 flex-1 flex-col items-center justify-center rounded-lg px-1 text-xs font-medium",
                isSelected
                  ? "bg-surface font-semibold text-fg shadow-card"
                  : "text-muted",
              )}
            >
              <span className="truncate">{columnLabel[status]}</span>
              <span className="num text-sm font-semibold">{count}</span>
            </button>
          );
        })}
      </div>
      <div
        id="board-panel"
        role="tabpanel"
        aria-labelledby={`tab-${selected}`}
        className="kanban-mobile-scroll"
        tabIndex={0}
      >
        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            No hay tareas en «{columnLabel[selected]}».
          </p>
        ) : (
          visible.map((task, i) => (
            <div key={task.id} className="enter" style={stagger(i)}>
              <TaskCard
                task={task}
                assignee={props.members.find((m) => m.id === task.assigneeId)}
                readOnly={props.readOnly}
                moveControl={{
                  value: props.columnFor(task),
                  options: STATUSES.map((value) => ({
                    value,
                    label: columnLabel[value],
                  })),
                  onChange: (value) =>
                    props.onColumnMove(task, value as BoardColumn),
                }}
                projectName={
                  props.projectNames?.[task.projectId ?? ""] ??
                  (task.projectId ? "Tarea de proyecto" : "Sin proyecto")
                }
                canTrack={false}
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
  const weekKey = todayLima(weekRange(new Date()).start)
    .split("-")
    .map(Number)
    .join("-");
  const storageKey = "vexa:task-week:" + props.currentUserId + ":" + weekKey;
  return <PlannedBoard key={storageKey} {...props} storageKey={storageKey} />;
}

function PlannedBoard({
  storageKey,
  ...props
}: KanbanBoardProps & { storageKey: string }) {
  const isDesktop = useMediaQuery("(min-width: 64rem)");
  const [planned, setPlanned] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(storageKey) ?? "[]",
      );
      return Array.isArray(saved)
        ? saved.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(planned));
    } catch {
      // Keep the board usable in this session if browser storage is unavailable.
    }
  }, [storageKey, planned]);
  const columnFor = (task: Task): BoardColumn =>
    task.status === "todo" && planned.includes(task.id) ? "week" : task.status;
  const onColumnMove = (task: Task, column: BoardColumn) => {
    if (props.readOnly || props.busy) return;
    if (column === "week") {
      setPlanned((ids) => (ids.includes(task.id) ? ids : [...ids, task.id]));
    } else if (column === "todo") {
      setPlanned((ids) => ids.filter((id) => id !== task.id));
    }
    const status = column === "week" ? "todo" : column;
    if (task.status !== status) props.onMove(task, status);
  };
  const boardProps = { ...props, columnFor, onColumnMove };
  return isDesktop ? (
    <DesktopBoard {...boardProps} />
  ) : (
    <MobileBoard {...boardProps} />
  );
}

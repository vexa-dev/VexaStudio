"use client";
import { useEffect, useRef, useState } from "react";
import { useAnimate, useReducedMotion } from "motion/react";
import {
  Bell,
  BellRing,
  CheckCheck,
  Clock3,
  MessageSquare,
  Volume2,
  VolumeX,
  ArrowUpRight,
  FolderPlus,
  ListChecks,
} from "lucide-react";
import type { Notification, Profile } from "@vexa/domain/types";
import { formatDateTime } from "@vexa/domain/dates";
import { SidePanel } from "@/components/ui/SidePanel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/ui/Avatar";
import { useNavigate } from "react-router-dom";
import { canAccessStudio } from "@vexa/domain/access";
import { isSupabaseSource } from "@/services/supabase/data-source";
import { motionTokens, shouldAnimate } from "@/lib/motion-tokens";
import {
  notificationChime,
  prepareNotificationSound,
} from "./notification-audio";
import { useNotifications } from "./hooks/useNotifications";
import "../../app/user-menu.css";
import "./notifications.css";

function notificationAction(item: Notification, user: Profile) {
  switch (item.type) {
    case "project_added":
      return {
        label: "Abrir proyecto",
        to: item.payload.projectId
          ? `/proyectos/${encodeURIComponent(item.payload.projectId)}`
          : "/proyectos",
      };
    case "task_assigned":
      return {
        label: "Ver tarea asignada",
        to: item.payload.taskId
          ? `/tareas?tarea=${encodeURIComponent(item.payload.taskId)}`
          : "/tareas",
      };
    case "daily_pending":
      return { label: "Completar mi daily", to: "/mi-dia" };
    case "hours_missing":
      return { label: "Registrar mis horas", to: "/horas" };
    case "expense_vote":
    case "expense_result":
    case "renewal":
      return user.role === "admin"
        ? { label: "Revisar gastos", to: "/gastos" }
        : null;
    case "mention":
      // Tagged in an hours entry (`entryId`): the entry lives in Horas.
      if (item.payload.entryId) return { label: "Ver mis horas", to: "/horas" };
      if (!item.payload.taskId && item.payload.projectId)
        return {
          label: "Ver proyecto",
          to: `/proyectos/${encodeURIComponent(item.payload.projectId)}`,
        };
      return {
        label: item.payload.taskId ? "Ver tarea" : "Ver mis tareas",
        to: item.payload.taskId
          ? `/tareas?tarea=${encodeURIComponent(item.payload.taskId)}`
          : "/tareas",
      };
    case "meeting":
      return canAccessStudio(user.role)
        ? { label: "Ver equipo", to: "/equipo" }
        : null;
  }
}

function examples(user: Profile): Notification[] {
  const userId = user.id;
  return [
    {
      id: "demo-project",
      userId,
      type: "project_added",
      read: false,
      createdAt: new Date().toISOString(),
      payload: {
        title: "Te agregaron a un proyecto",
        message: `Rober Vasquez te agregó a Vexa Studio como integrante.`,
        actorName: "Rober Vasquez",
        actorRole: "Administrador del proyecto",
        recipientName: user.name,
        projectName: "Vexa Studio",
        projectId: "p-vexa",
        memberRole: "Integrante",
        details:
          "Ya formas parte del equipo del proyecto. Puedes consultar su tablero, revisar el objetivo del sprint y conocer las tareas en las que trabaja el equipo.",
        nextStep:
          "Abre el proyecto y revisa el tablero para conocer el contexto de tu participación.",
      },
    },
    {
      id: "demo-assignment",
      userId,
      type: "task_assigned",
      read: false,
      createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
      payload: {
        title: "Tienes una nueva tarea asignada",
        message: "Jhony Rivera te asignó «Revisar la propuesta del proyecto».",
        actorName: "Jhony Rivera",
        actorRole: "Administrador",
        recipientName: user.name,
        projectName: "Vexa Studio",
        projectId: "p-vexa",
        taskName: "Revisar la propuesta del proyecto",
        details:
          "Revisa los requisitos, identifica dudas y prepara tus observaciones antes de comenzar el trabajo.",
        nextStep:
          "Ve a Mis tareas para consultar tus asignaciones. Esta tarea es un ejemplo y no modifica el tablero.",
      },
    },
    {
      id: "demo-hours",
      userId,
      type: "hours_missing",
      payload: {
        title: "Recuerda registrar tus horas",
        message: "Al terminar tu jornada, confirma las horas de tus tareas.",
        details:
          "Abre Horas para revisar tus registros pendientes, confirmar el tiempo dedicado a tus tareas o añadir una actividad manual.",
        actorName: "VEXA Studio",
        actorRole: "Recordatorio automático",
        recipientName: user.name,
        nextStep:
          "Confirma las horas pendientes o añade un registro manual en Horas.",
      },
      read: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: "demo-mention",
      userId,
      type: "mention",
      payload: {
        title: "Te mencionaron en un proyecto",
        message: "Diego Choque te mencionó en Vexa Studio.",
        actorName: "Diego Choque",
        actorRole: "Integrante del equipo",
        recipientName: user.name,
        projectName: "Vexa Studio",
        projectId: "p-vexa",
        comment:
          "¿Puedes revisar la propuesta y compartir tus observaciones con el equipo?",
        nextStep:
          "Revisa el contexto del proyecto y coordina tus observaciones con el equipo.",
        details:
          "Abre Mis tareas para consultar el contexto del trabajo y revisar lo que necesita tu atención. Este aviso es un ejemplo de la vista.",
      },
      read: false,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];
}

/** Con Supabase muestra los avisos de la cuenta; con el mock, ejemplos locales de vista previa. */
export function NotificationMenu({ user }: { user: Profile }) {
  const demo = !isSupabaseSource();
  const [localItems, setItems] = useState<Notification[]>(() =>
    demo ? examples(user) : [],
  );
  const remote = useNotifications(demo ? undefined : user.id);
  const items = demo ? localItems : remote.items;
  // Con Supabase, la primera carga es la base: solo lo que llega después suena y mueve la campana.
  const primed = useRef(demo);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Notification | null>(null);
  const navigate = useNavigate();
  const action = selected ? notificationAction(selected, user) : null;
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [sound, setSound] = useState(true);
  const [scope, animate] = useAnimate();
  const reduced = useReducedMotion();
  const seen = useRef(new Set(items.map((item) => item.id)));
  const unread = items.filter((item) => !item.read).length;
  const visible = onlyUnread ? items.filter((item) => !item.read) : items;

  useEffect(() => {
    if (!sound) return;
    const unlock = () => {
      void prepareNotificationSound();
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [sound]);
  const markRead = (id: string) => {
    if (demo)
      setItems((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, read: true } : entry,
        ),
      );
    else remote.markRead(id);
  };
  const markAllRead = () => {
    if (demo)
      setItems((current) => current.map((item) => ({ ...item, read: true })));
    else remote.markAllRead();
  };

  useEffect(() => {
    if (!demo && !remote.loaded) return;
    if (!primed.current) {
      items.forEach((item) => seen.current.add(item.id));
      primed.current = true;
      return;
    }
    const incoming = items.some(
      (item) => !seen.current.has(item.id) && !item.read,
    );
    items.forEach((item) => seen.current.add(item.id));
    if (!incoming) return;
    if (sound) notificationChime();
    if (reduced || !shouldAnimate(true) || !scope.current) return;
    const angle = motionTokens.notification.ringDegrees;
    const animation = animate(
      scope.current,
      { rotate: [0, -angle, angle, -angle, angle, -angle / 2, angle / 2, 0] },
      { duration: motionTokens.duration.slow },
    );
    return () => animation.stop();
  }, [items, demo, remote.loaded, sound, reduced, animate, scope]);

  return (
    <>
      <button
        type="button"
        className="notification-trigger"
        aria-label={`Notificaciones${unread ? `, ${unread} sin revisar` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span ref={scope} className="notification-bell">
          <Bell size={20} aria-hidden="true" />
        </span>
        {unread > 0 && <span className="notification-dot" aria-hidden="true" />}
      </button>
      <span className="sr-only" aria-live="polite">
        {unread
          ? `${unread} notificaciones sin revisar`
          : "Sin notificaciones pendientes"}
      </span>
      {open && (
        <SidePanel title="Notificaciones" onClose={() => setOpen(false)}>
          <div className="notification-panel-intro">
            <p>Lo que necesita tu atención, en un solo lugar.</p>
            {unread > 0 && <Badge tone="primary">{unread} sin revisar</Badge>}
          </div>
          <div className="notification-toolbar">
            <Button
              variant="ghost"
              aria-pressed={sound}
              onClick={() => {
                setSound(!sound);
                if (!sound) void prepareNotificationSound();
              }}
            >
              {sound ? (
                <Volume2 size={17} aria-hidden="true" />
              ) : (
                <VolumeX size={17} aria-hidden="true" />
              )}
              {sound ? "Sonido activado" : "Sonido desactivado"}
            </Button>
            <Button
              variant="ghost"
              disabled={!unread}
              onClick={markAllRead}
            >
              <CheckCheck size={17} aria-hidden="true" />
              Revisar todas
            </Button>
          </div>
          <div className="notification-tabs">
            <button
              type="button"
              aria-pressed={!onlyUnread}
              onClick={() => setOnlyUnread(false)}
            >
              Todas
            </button>
            <button
              type="button"
              aria-pressed={onlyUnread}
              onClick={() => setOnlyUnread(true)}
            >
              Sin revisar {unread > 0 && <span>{unread}</span>}
            </button>
          </div>
          {demo && (
            <p className="notification-preview-note">
              Notificaciones de ejemplo. Puedes probar cómo llega un aviso.
            </p>
          )}
          <div className="notification-list">
            {visible.length ? (
              visible.map((item) => {
                const Icon =
                  item.type === "project_added"
                    ? FolderPlus
                    : item.type === "task_assigned"
                      ? ListChecks
                      : item.type === "mention"
                        ? MessageSquare
                        : Clock3;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`notification-item${item.read ? "" : " notification-item-unread"}`}
                    aria-haspopup="dialog"
                    onClick={() => {
                      setSelected(item);
                      if (!item.read) markRead(item.id);
                    }}
                  >
                    <span className="notification-item-icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="notification-item-content">
                      <strong>{item.payload.title}</strong>
                      <span className="notification-item-summary">
                        {item.payload.message}
                      </span>
                      <time dateTime={item.createdAt}>
                        {formatDateTime(item.createdAt)}
                      </time>
                    </span>
                    {!item.read && (
                      <span
                        className="notification-item-dot"
                        aria-label="Sin revisar"
                      />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="notification-empty">
                <BellRing size={32} aria-hidden="true" />
                <h3>{onlyUnread ? "Todo al día" : "Sin notificaciones"}</h3>
                <p>
                  {onlyUnread
                    ? "Ya revisaste todos tus avisos."
                    : "Tus próximos avisos aparecerán aquí."}
                </p>
              </div>
            )}
          </div>
          {demo && (
            <div className="notification-test">
              <Button
                variant="secondary"
                onClick={async () => {
                  if (sound) await prepareNotificationSound();
                  setItems((current) =>
                    [
                      {
                        id: crypto.randomUUID(),
                        userId: user.id,
                        type: "project_added" as const,
                        payload: { ...examples(user)[0].payload },
                        read: false,
                        createdAt: new Date().toISOString(),
                      },
                      ...current,
                    ].slice(0, 50),
                  );
                }}
              >
                Probar nueva notificación
              </Button>
              <p>
                La prueba activa el sonido, la vibración de la campana y el
                punto de pendientes.
              </p>
            </div>
          )}
        </SidePanel>
      )}
      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Detalle de notificación"
      >
        {selected && (
          <div className="notification-detail">
            {demo && <Badge>Vista previa</Badge>}
            <h3>{selected.payload.title}</h3>
            <div className="notification-detail-person">
              <Avatar name={selected.payload.actorName || "Usuario"} />
              <div>
                <strong>
                  {selected.payload.actorName || "Autor no disponible"}
                </strong>
                <span>
                  {selected.payload.actorRole || "Aviso del espacio de trabajo"}
                </span>
              </div>
            </div>
            <dl className="notification-detail-meta">
              <div>
                <dt>Fecha y hora · Lima</dt>
                <dd>
                  <time dateTime={selected.createdAt}>
                    {formatDateTime(selected.createdAt)}
                  </time>
                </dd>
              </div>
              <div>
                <dt>Para</dt>
                <dd>{selected.payload.recipientName || user.name}</dd>
              </div>
              {selected.payload.projectName && (
                <div>
                  <dt>Proyecto</dt>
                  <dd>{selected.payload.projectName}</dd>
                </div>
              )}
              {selected.payload.taskName && (
                <div>
                  <dt>Tarea</dt>
                  <dd>{selected.payload.taskName}</dd>
                </div>
              )}
              {selected.payload.memberRole && (
                <div>
                  <dt>Tu participación</dt>
                  <dd>{selected.payload.memberRole}</dd>
                </div>
              )}
            </dl>
            <p>{selected.payload.message}</p>
            {selected.payload.details && <p>{selected.payload.details}</p>}
            {selected.payload.comment && (
              <blockquote className="notification-detail-comment">
                {selected.payload.comment}
              </blockquote>
            )}
            {selected.payload.nextStep && (
              <div className="notification-detail-next">
                <h4>Qué debes hacer</h4>
                <p>{selected.payload.nextStep}</p>
              </div>
            )}
            <div className="notification-detail-actions">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Cerrar
              </Button>
              {action && (
                <Button
                  onClick={() => {
                    setSelected(null);
                    setOpen(false);
                    navigate(action.to);
                  }}
                >
                  {action.label}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}

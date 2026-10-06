import { useId, useState } from "react";
import type { NotificationPreferences } from "@vexa/domain/types";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "../hooks/useAccountSettings";

const rows: {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
}[] = [
  {
    key: "taskAssigned",
    title: "Nuevas asignaciones",
    description: "Un aviso cuando recibas una tarea.",
  },
  {
    key: "hoursReminder",
    title: "Recordatorio de horas",
    description: "Recuerda confirmar tus horas al terminar el día.",
  },
  {
    key: "weeklySummary",
    title: "Resumen semanal",
    description: "Tu avance y próximos pendientes de la semana.",
  },
];

function PreferenceSwitch({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="profile-preference-row">
      <div>
        <label htmlFor={id}>{title}</label>
        <p>{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${title}: ${checked ? "activado" : "desactivado"}`}
        className="profile-switch"
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

function sameValues(a: NotificationPreferences, b: NotificationPreferences) {
  return rows.every(({ key }) => a[key] === b[key]);
}

/** Notification switches bound to the saved preferences; saved together with one button. */
export function NotificationPrefs() {
  const query = useNotificationPreferences();
  const save = useUpdateNotificationPreferences();
  // Unsaved switch changes sit on top of what the server holds.
  const [edits, setEdits] = useState<Partial<NotificationPreferences>>({});
  const saved = query.data;

  if (query.isError)
    return (
      <ErrorState
        title="No se pudieron cargar tus preferencias"
        message={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );
  if (!saved)
    return (
      <output className="flex flex-col gap-3" aria-label="Cargando preferencias de avisos">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </output>
    );

  const draft: NotificationPreferences = { ...saved, ...edits };
  const dirty = !sameValues(saved, draft);
  return (
    <>
      {rows.map(({ key, title, description }) => (
        <PreferenceSwitch
          key={key}
          title={title}
          description={description}
          checked={draft[key]}
          onChange={(next) => setEdits({ ...edits, [key]: next })}
        />
      ))}
      <div className="profile-footer">
        <p>
          El recordatorio de horas y el resumen semanal se guardan, pero aún no se envían. Se
          activarán pronto.
        </p>
        <Button disabled={!dirty || save.isPending} onClick={() => save.mutate(draft, { onSuccess: () => setEdits({}) })}>
          {save.isPending ? "Guardando…" : "Guardar preferencias"}
        </Button>
      </div>
    </>
  );
}

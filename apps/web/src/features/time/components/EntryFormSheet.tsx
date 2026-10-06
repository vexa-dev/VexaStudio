import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field, TextareaField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import type { TimeEntry } from "@vexa/domain/types";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { todayLima } from "@vexa/domain/dates";
import { limaInstant } from "@vexa/domain/clock";
import type { HoursParticipantInput } from "@vexa/services";
import {
  useAddEvidence,
  useAddManualEntry,
  useEntries,
  useSetParticipants,
  useUpdateEntry,
} from "../hooks/useTime";
import { hasParticipantErrors, participantErrors, sameParticipants } from "../participants";
import { EVIDENCE_RETENTION_TEXT } from "../evidence-files";
import { EvidenceFiles, EvidencePicker } from "./EvidenceFiles";
import { ParticipantsField } from "./ParticipantsField";
import { lastEndOnDate } from "../last-end";
import { ClockTimeField } from "./ClockTimeField";
import { ChoicePicker, DatePicker } from "./TimePickers";
import { entrySchema, type EntryFormValues } from "../schemas";

interface EntryFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** Registro a editar; sin él, se crea uno nuevo. */
  entry?: TimeEntry;
}

function EntryForm({
  entry,
  onClose,
}: {
  entry?: TimeEntry;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const tasks = useTasks({ assigneeId: user?.id });
  const projects = useProjects();
  const add = useAddManualEntry();
  const update = useUpdateEntry();
  const setParticipants = useSetParticipants();
  const addEvidence = useAddEvidence();
  const [participants, setLocalParticipants] = useState<
    HoursParticipantInput[]
  >(() =>
    (entry?.participants ?? []).map((p) => ({
      userId: p.userId,
      sharePercent: p.sharePercent,
    })),
  );
  const [queued, setQueued] = useState<File[]>([]);

  const { register, handleSubmit, formState, control } =
    useForm<EntryFormValues>({
      resolver: zodResolver(entrySchema),
      defaultValues: {
        taskId: entry?.taskId ?? "",
        projectId: entry?.projectId ?? "",
        description: entry?.description ?? "",
        evidenceUrl: entry?.evidenceUrl ?? "",
        startTime: entry
          ? new Date(new Date(entry.startedAt).getTime() - 5 * 3600000)
              .toISOString()
              .slice(11, 16)
          : "09:00",
        date: entry ? todayLima(new Date(entry.startedAt)) : todayLima(),
        hours: entry?.hours,
      },
    });

  const [watchedDate, watchedHours] = useWatch({
    control,
    name: ["date", "hours"],
  });
  const dayStart = /^\d{4}-\d{2}-\d{2}$/.test(watchedDate ?? "")
    ? limaInstant(watchedDate, { hour24: 0, minute: 0 }).getTime()
    : null;
  const dayEntries = useEntries(
    {
      from: new Date((dayStart ?? 0) - 86400000).toISOString(),
      to: new Date((dayStart ?? 0) + 86400000 - 1).toISOString(),
    },
    dayStart === null ? undefined : user?.id,
  );
  const lastEnd =
    dayStart !== null && user
      ? lastEndOnDate(
          (dayEntries.data ?? []).filter((e) => e.id !== entry?.id),
          watchedDate,
          user.id,
        )
      : null;

  const projectName = (id: string | null) =>
    projects.data?.find((p) => p.id === id)?.name ?? "";
  const options = tasks.data ?? [];
  const submit = handleSubmit(
    async ({
      taskId,
      date,
      hours,
      projectId,
      description,
      evidenceUrl,
      startTime,
    }) => {
      // El horario ingresado corresponde a Lima (UTC-5).
      const startedAt = new Date(`${date}T${startTime}:00-05:00`).toISOString();
      if (
        user &&
        hasParticipantErrors(participantErrors(user.id, participants))
      ) {
        toast.error("Revisa las personas etiquetadas.");
        return;
      }
      try {
        if (entry) {
          await update.mutateAsync({
            id: entry.id,
            patch: {
              taskId: taskId || null,
              hours,
              startedAt,
              projectId: projectId || null,
              description,
              evidenceUrl: evidenceUrl || null,
            },
          });
          if (!sameParticipants(participants, entry.participants ?? []))
            await setParticipants.mutateAsync({
              entryId: entry.id,
              participants,
            });
        } else {
          const created = await add.mutateAsync({
            taskId: taskId || null,
            date,
            hours,
            projectId: projectId || null,
            description,
            evidenceUrl: evidenceUrl || null,
            startTime,
            participants,
          });
          let uploaded = 0;
          for (const file of queued) {
            try {
              await addEvidence.mutateAsync({
                entryId: created.id,
                file,
                silent: true,
              });
              uploaded += 1;
            } catch {
              /* The hook already reported this file; it can be attached again from the detail. */
            }
          }
          if (uploaded)
            toast.success(
              uploaded === 1 ? "Archivo adjuntado" : `${uploaded} archivos adjuntados`,
            );
        }
        onClose();
      } catch {
        /* El hook muestra el error y conserva el formulario. */
      }
    },
  );

  const pending =
    add.isPending ||
    update.isPending ||
    setParticipants.isPending ||
    addEvidence.isPending;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Controller
        name="taskId"
        control={control}
        render={({ field }) => (
          <ChoicePicker
            label="Tarea (opcional)"
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: "", label: "Sin tarea · Trabajo del estudio" },
              ...options.map((t) => ({
                value: t.id,
                label: `${projectName(t.projectId)} · ${t.title}`,
              })),
            ]}
          />
        )}
      />
      <Controller
        name="projectId"
        control={control}
        render={({ field }) => (
          <ChoicePicker
            label="Proyecto (opcional)"
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: "", label: "Trabajo del estudio" },
              ...(projects.data ?? []).map((p) => ({
                value: p.id,
                label: p.name,
              })),
            ]}
          />
        )}
      />
      <TextareaField
        label="¿Qué hiciste y qué avanzaste?"
        rows={3}
        error={formState.errors.description?.message}
        {...register("description")}
      />
      <Field
        label="Enlace de respaldo (opcional)"
        type="url"
        placeholder="https://…"
        error={formState.errors.evidenceUrl?.message}
        {...register("evidenceUrl")}
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Controller
            name="date"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="Fecha"
                value={field.value}
                max={todayLima()}
                onChange={field.onChange}
              />
            )}
          />
          {formState.errors.date ? (
            <p className="text-xs text-danger">
              {formState.errors.date.message}
            </p>
          ) : null}
        </div>
        <Field
          label="Horas"
          type="number"
          inputMode="decimal"
          step="0.25"
          min="0"
          placeholder="1.5"
          error={formState.errors.hours?.message}
          {...register("hours", { valueAsNumber: true })}
        />
      </div>
      <Controller
        name="startTime"
        control={control}
        render={({ field }) => (
          <ClockTimeField
            label="Hora de inicio (Lima)"
            value={field.value}
            onChange={field.onChange}
            error={formState.errors.startTime?.message}
            date={watchedDate}
            hours={watchedHours}
            target={lastEnd}
          />
        )}
      />
      {user ? (
        <ParticipantsField
          ownerId={user.id}
          value={participants}
          onChange={setLocalParticipants}
          hours={Number.isFinite(watchedHours) ? watchedHours : undefined}
          disabled={pending}
        />
      ) : null}
      {entry ? (
        <EvidenceFiles
          entryId={entry.id}
          evidence={entry.evidence}
          editable
        />
      ) : (
        <div className="flex flex-col gap-2">
          <EvidencePicker
            existing={queued.length}
            busy={pending}
            onFiles={(files) => setQueued((prev) => [...prev, ...files])}
          />
          {queued.length ? (
            <ul className="flex flex-col gap-1.5">
              {queued.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Quitar ${file.name}`}
                    onClick={() =>
                      setQueued((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <X size={16} aria-hidden="true" />
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted">{EVIDENCE_RETENTION_TEXT}</p>
        </div>
      )}
      <p className="text-xs text-muted">
        Editar un registro aprobado lo devuelve a revisión. Queda pendiente de
        revisión por otro socio. El horario debe haber terminado y no
        superponerse con otro registro.
      </p>
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {entry ? "Guardar cambios" : "Registrar horas"}
        </Button>
      </div>
    </form>
  );
}

export function EntryFormSheet({ open, onClose, entry }: EntryFormSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? "Editar registro" : "Registrar horas"}
      description={
        entry
          ? undefined
          : "Registra tu actividad, incluso sin una tarea asignada."
      }
    >
      <EntryForm entry={entry} onClose={onClose} />
    </Sheet>
  );
}

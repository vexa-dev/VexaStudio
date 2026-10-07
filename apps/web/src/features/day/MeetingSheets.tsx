import { useState } from "react";
import { limaInstant, parseClockTime } from "@vexa/domain/clock";
import { formatDateTime, todayLima } from "@vexa/domain/dates";
import {
  MAX_SLOTS,
  isMeetLink,
  validateMeetLink,
  validateSlotStarts,
} from "@vexa/domain/meetings";
import type { Id, IsoDateTime, Profile } from "@vexa/domain/types";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { ClockTimeField } from "@/features/time/components/ClockTimeField";
import { DatePicker } from "@/features/time/components/TimePickers";
import { useMeetingActions } from "@/features/meetings/hooks/useMeetings";

interface SlotDraft {
  date: string;
  time: string;
}

const emptyDrafts = (): SlotDraft[] =>
  Array.from({ length: MAX_SLOTS }, () => ({ date: "", time: "15:00" }));

/** Convocar: 2 o 3 horarios (fecha y hora de Lima). Las filas sin fecha se ignoran. */
export function ProposeMeetingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { propose } = useMeetingActions();
  const [drafts, setDrafts] = useState<SlotDraft[]>(emptyDrafts);
  const [error, setError] = useState("");

  const change = (index: number, patch: Partial<SlotDraft>) =>
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const submit = async () => {
    const starts: IsoDateTime[] = [];
    for (const draft of drafts) {
      if (!draft.date) continue;
      const time = parseClockTime(draft.time);
      if (!time) {
        setError("Hay una hora no válida");
        return;
      }
      starts.push(limaInstant(draft.date, time).toISOString());
    }
    const message = validateSlotStarts(starts);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    try {
      await propose.mutateAsync(starts);
      setDrafts(emptyDrafts());
      onClose();
    } catch {
      // El aviso de error lo muestra el hook y los horarios se conservan.
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Convocar reunión semanal"
      description="Propón 2 o 3 horarios de esta semana o la siguiente (hora de Lima)."
    >
      <form
        className="flex flex-col gap-4 overflow-y-auto px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {drafts.map((draft, index) => (
          <fieldset key={index} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-medium">
              Horario {index + 1}
              {index >= 2 ? " (opcional)" : ""}
            </legend>
            <DatePicker
              label={`Fecha del horario ${index + 1}`}
              value={draft.date}
              min={todayLima()}
              onChange={(date) => change(index, { date })}
            />
            <ClockTimeField
              label={`Hora del horario ${index + 1} (Lima)`}
              value={draft.time}
              onChange={(time) => change(index, { time })}
            />
          </fieldset>
        ))}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={propose.isPending}>
            {propose.isPending ? "Convocando…" : "Convocar"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** Confirmar un horario con el enlace de la reunión (https; se prefiere Google Meet). */
export function ConfirmMeetingSheet({
  target,
  onClose,
}: {
  target: { meetingId: Id; slotId: Id; startsAt: IsoDateTime } | null;
  onClose: () => void;
}) {
  const { confirm } = useMeetingActions();
  const [link, setLink] = useState("");
  const [touched, setTouched] = useState(false);
  const error = touched ? (validateMeetLink(link) ?? undefined) : undefined;
  const notMeet = !validateMeetLink(link) && !isMeetLink(link);

  const submit = async () => {
    setTouched(true);
    if (!target || validateMeetLink(link)) return;
    try {
      await confirm.mutateAsync({ meetingId: target.meetingId, slotId: target.slotId, meetLink: link });
      setLink("");
      setTouched(false);
      onClose();
    } catch {
      // El aviso de error lo muestra el hook.
    }
  };

  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title="Confirmar reunión"
      description={target ? `Se confirmará para el ${formatDateTime(target.startsAt)} (Lima) y se avisará al equipo.` : undefined}
    >
      <form
        className="flex flex-col gap-4 px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field
          label="Enlace de la reunión"
          type="url"
          inputMode="url"
          placeholder="https://meet.google.com/abc-defg-hij"
          value={link}
          maxLength={500}
          error={error}
          hint={notMeet ? "No es un enlace de Google Meet; se acepta igual." : "Pega el enlace de Google Meet."}
          onChange={(event) => setLink(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={confirm.isPending}>
            {confirm.isPending ? "Confirmando…" : "Confirmar y avisar"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** Marcar asistencia: lista de admin y socios (ya empezada la reunión). */
export function AttendanceSheet({
  open,
  meetingId,
  members,
  initial,
  onClose,
}: {
  open: boolean;
  meetingId: Id;
  members: Pick<Profile, "id" | "name">[];
  initial: Id[];
  onClose: () => void;
}) {
  const { markAttendance } = useMeetingActions();
  const [selected, setSelected] = useState<Id[]>(initial);
  const toggle = (id: Id) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Marcar asistencia"
      description="Marca a quienes asistieron. Después la reunión queda como realizada."
    >
      <form
        className="flex flex-col gap-3 overflow-y-auto px-5 py-4"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await markAttendance.mutateAsync({ meetingId, attendeeIds: selected });
            onClose();
          } catch {
            // El aviso de error lo muestra el hook.
          }
        }}
      >
        <ul className="flex flex-col gap-1">
          {members.map((member) => (
            <li key={member.id}>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selected.includes(member.id)}
                  onChange={() => toggle(member.id)}
                />
                {member.name}
              </label>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={markAttendance.isPending}>
            {markAttendance.isPending ? "Guardando…" : "Guardar asistencia"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

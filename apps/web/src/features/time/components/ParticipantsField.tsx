import { X } from "lucide-react";
import type { HoursParticipantInput } from "@vexa/services";
import { MAX_PARTICIPANTS } from "@vexa/domain/hours-credit";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { Field } from "@/components/ui/Field";
import { useMembers } from "@/features/team/hooks/useMembers";
import { creditExample, participantErrors } from "../participants";

interface ParticipantsFieldProps {
  /** The person registering: never taggable. */
  ownerId: string;
  value: HoursParticipantInput[];
  onChange: (value: HoursParticipantInput[]) => void;
  /** Hours of the entry, to show what each person gets. */
  hours?: number;
  disabled?: boolean;
}

/** Tag the members who helped and set which share of the hours counts for each one. */
export function ParticipantsField({
  ownerId,
  value,
  onChange,
  hours,
  disabled = false,
}: ParticipantsFieldProps) {
  const members = useMembers();
  const errors = participantErrors(ownerId, value);
  const nameOf = (id: string) =>
    members.data?.find((m) => m.id === id)?.name ?? "Socio";
  const taken = new Set(value.map((p) => p.userId));
  const options = (members.data ?? [])
    .filter((m) => m.active && m.id !== ownerId && !taken.has(m.id))
    .map((m) => ({ value: m.id, label: m.name }));
  const full = value.length >= MAX_PARTICIPANTS;

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="text-sm font-medium">
        Personas que te ayudaron (opcional)
      </legend>
      <p className="text-sm text-muted">
        Etiqueta a quien colaboró y define qué porcentaje de las horas cuenta
        para esa persona. Tú siempre conservas el 100 %. Ejemplo:{" "}
        <span className="num">2 h al 75 % = 1.5 h para Rober</span>.
      </p>
      {members.isError ? (
        <p role="alert" className="text-sm text-danger">
          No se pudo cargar al equipo. Intenta de nuevo más tarde.
        </p>
      ) : (
        <ChoicePicker
          label="Agregar persona"
          value=""
          disabled={disabled || full || members.isLoading || !options.length}
          options={options}
          onChange={(id) =>
            id && onChange([...value, { userId: id, sharePercent: 100 }])
          }
        />
      )}
      {full ? (
        <p className="text-sm text-muted">
          Llegaste al máximo de {MAX_PARTICIPANTS} personas.
        </p>
      ) : null}
      {errors.list ? (
        <p role="alert" className="text-sm text-danger">
          {errors.list}
        </p>
      ) : null}
      {value.length ? (
        <ul className="flex flex-col gap-3">
          {value.map((p, index) => {
            const share = p.sharePercent ?? 100;
            const name = nameOf(p.userId);
            return (
              <li
                key={p.userId}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={name}
                    size="sm"
                    src={members.data?.find((m) => m.id === p.userId)?.avatarUrl}
                  />
                  <strong className="min-w-0 flex-1 truncate text-sm">
                    {name}
                  </strong>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Quitar a ${name}`}
                    onClick={() =>
                      onChange(value.filter((x) => x.userId !== p.userId))
                    }
                  >
                    <X size={16} aria-hidden="true" />
                    Quitar
                  </Button>
                </div>
                <Field
                  label={`Porcentaje para ${name} (1 a 100)`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  step={1}
                  className="num"
                  value={Number.isNaN(share) ? "" : share}
                  error={errors.rows[index]}
                  hint={creditExample(hours, share, name)}
                  onChange={(e) =>
                    onChange(
                      value.map((x) =>
                        x.userId === p.userId
                          ? {
                              ...x,
                              sharePercent:
                                e.target.value === ""
                                  ? Number.NaN
                                  : Number(e.target.value),
                            }
                          : x,
                      ),
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </fieldset>
  );
}

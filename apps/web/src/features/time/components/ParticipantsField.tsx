import { X } from "lucide-react";
import type { HoursParticipantInput } from "@vexa/services";
import { MAX_PARTICIPANTS } from "@vexa/domain/hours-credit";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ParticipantPicker } from "./ParticipantPicker";
import { Field } from "@/components/ui/Field";
import { useMembers } from "@/features/team/hooks/useMembers";
import { creditHint, participantErrors } from "../participants";

interface ParticipantsFieldProps {
  /** The person registering: never taggable. */
  ownerId: string;
  value: HoursParticipantInput[];
  onChange: (value: HoursParticipantInput[]) => void;
  /** Hours of the entry, to show what each person gets. */
  hours?: number;
  disabled?: boolean;
  compact?: boolean;
}

/** Tag the members who helped and set which share of the hours counts for each one. */
export function ParticipantsField({
  ownerId,
  value,
  onChange,
  hours,
  disabled = false,
  compact = false,
}: ParticipantsFieldProps) {
  const members = useMembers();
  const errors = participantErrors(ownerId, value);
  const nameOf = (id: string) =>
    members.data?.find((m) => m.id === id)?.name ?? "Socio";
  const full = value.length >= MAX_PARTICIPANTS;

  return (
    <fieldset
      className={compact ? "hours-collaborators" : "flex flex-col gap-3"}
      disabled={disabled}
    >
      <legend className={compact ? "sr-only" : "text-sm font-medium"}>
        Personas que te ayudaron (opcional)
      </legend>
      <p className="text-sm text-muted">
        {compact
          ? "¿Quién te ayudó? Tú conservas el 100 %."
          : "Define qué porcentaje de las horas cuenta para cada persona. Tú conservas el 100 %."}
      </p>
      <ParticipantPicker
        compact={compact}
        people={(members.data ?? []).filter(
          (m) => m.active && m.id !== ownerId,
        )}
        value={value.map((p) => p.userId)}
        onChange={(ids) =>
          onChange(
            ids.map(
              (userId) =>
                value.find((p) => p.userId === userId) ?? {
                  userId,
                  sharePercent: 100,
                },
            ),
          )
        }
        onBlur={() => {}}
        disabled={disabled || full}
        loading={members.isPending}
        error={members.isError}
        showSelected={false}
      />
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
      {compact && value.length > 0 && (
        <div
          className="hours-collaborator-bubbles"
          aria-label="Colaboradores seleccionados"
        >
          {value.map((p, index) => {
            const name = nameOf(p.userId);
            const share = p.sharePercent ?? 100;
            return (
              <details className="hours-collaborator-bubble" key={p.userId}>
                <summary
                  aria-label={`Editar colaboración de ${name}`}
                  title={name}
                >
                  <Avatar
                    name={name}
                    size="sm"
                    src={
                      members.data?.find((m) => m.id === p.userId)?.avatarUrl
                    }
                  />
                </summary>
                <div className="hours-collaborator-popover">
                  <strong>{name}</strong>
                  <Field
                    label={`Porcentaje para ${name}`}
                    type="number"
                    min={1}
                    max={100}
                    value={Number.isNaN(share) ? "" : share}
                    error={errors.rows[index]}
                    hint={creditHint(hours, share)}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onChange(value.filter((x) => x.userId !== p.userId))
                    }
                    aria-label={`Quitar a ${name}`}
                  >
                    <X size={14} /> Quitar
                  </Button>
                </div>
              </details>
            );
          })}
        </div>
      )}
      {!compact && value.length ? (
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
                    src={
                      members.data?.find((m) => m.id === p.userId)?.avatarUrl
                    }
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
                  hint={creditHint(hours, share)}
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

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { TextareaField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import type { TimeEntry } from "@/domain/types";
import { formatHours } from "@/lib/format";
import { useVoidEntry } from "../hooks/useTime";
import { voidSchema, type VoidFormValues } from "../schemas";

function VoidForm({
  entry,
  onClose,
}: {
  entry: TimeEntry;
  onClose: () => void;
}) {
  const voidEntry = useVoidEntry();
  const { register, handleSubmit, formState } = useForm<VoidFormValues>({
    resolver: zodResolver(voidSchema),
    defaultValues: { reason: "" },
  });
  const submit = handleSubmit(async ({ reason }) => {
    await voidEntry.mutateAsync({ id: entry.id, reason });
    onClose();
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Nadie borra registros: al anular, el de {formatHours(entry.hours)} deja
        de contar y queda en el historial con tu motivo.
      </p>
      <TextareaField
        label="Motivo"
        placeholder="Por ejemplo: lo registré dos veces"
        error={formState.errors.reason?.message}
        {...register("reason")}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="danger" disabled={voidEntry.isPending}>
          Anular registro
        </Button>
      </div>
    </form>
  );
}

export function VoidEntrySheet({
  entry,
  onClose,
}: {
  entry: TimeEntry | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={entry !== null} onClose={onClose} title="Anular registro">
      {entry ? <VoidForm entry={entry} onClose={onClose} /> : null}
    </Sheet>
  );
}

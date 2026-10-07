import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import type { DataSource } from "@/services/supabase/data-source";
import {
  buildExpenseInput,
  expenseCategories,
  expenseErrorMessage,
  receiptMaxBytes,
  validateReceiptFile,
  type ExpenseDraft,
} from "../expense-actions";

const emptyDraft: ExpenseDraft = {
  amount: "",
  concept: "",
  currency: "PEN",
  category: "other",
  receiptUrl: null,
  beforeSigning: false,
};

function readReceipt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("No se pudo leer el comprobante."));
    reader.onerror = () => reject(new Error("No se pudo leer el comprobante."));
    reader.onabort = () =>
      reject(new Error("Se canceló la lectura del comprobante."));
    reader.readAsDataURL(file);
  });
}

export function CreateExpenseSheet({
  open,
  onClose,
  onCreate,
  pending,
  allowed,
  source,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (draft: ExpenseDraft) => Promise<unknown>;
  pending: boolean;
  allowed: boolean;
  source: DataSource;
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const busy = pending || reading;
  const update = (patch: Partial<ExpenseDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !allowed) return;
    setError(null);
    setReading(true);
    try {
      buildExpenseInput(draft, source);
      if (file) validateReceiptFile(file, source);
      const receiptUrl = file ? await readReceipt(file) : null;
      await onCreate({ ...draft, receiptUrl });
      setDraft(emptyDraft);
      setFile(null);
      onClose();
    } catch (failure) {
      setError(expenseErrorMessage(failure));
    } finally {
      setReading(false);
    }
  }
  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Registrar gasto"
      description="El estado se determina según las reglas del estudio."
    >
      <form
        onSubmit={(event) => void submit(event)}
        noValidate
        className="grid gap-4"
        aria-busy={busy}
      >
        <fieldset disabled={busy || !allowed} className="grid gap-4">
          <Field
            label="Concepto"
            value={draft.concept}
            onChange={(event) => update({ concept: event.target.value })}
            required
          />
          <Field
            label="Monto"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={draft.amount}
            onChange={(event) => update({ amount: event.target.value })}
            required
          />
          <ChoicePicker
            label="Moneda"
            value={draft.currency}
            onChange={(currency) => update({ currency })}
            disabled={busy || !allowed}
            options={[
              { value: "PEN", label: "Soles (PEN)" },
              { value: "USD", label: "Dólares (USD)" },
            ]}
          />
          <ChoicePicker
            label="Categoría"
            value={draft.category}
            onChange={(category) => update({ category })}
            disabled={busy || !allowed}
            options={Object.entries(expenseCategories).map(
              ([value, label]) => ({ value, label }),
            )}
          />
          <Field
            label="Comprobante (opcional)"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            hint={`JPEG, PNG, WebP o PDF; máximo ${receiptMaxBytes(source) / 1024 / 1024} MiB.`}
            onChange={(event) => {
              const next = event.target.files?.[0];
              if (!next) return;
              try {
                validateReceiptFile(next, source);
                setFile(next);
                setError(null);
              } catch (failure) {
                setError(expenseErrorMessage(failure));
                event.target.value = "";
              }
            }}
          />
          {file && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{file.name}</span>
              <Button variant="ghost" onClick={() => setFile(null)}>
                Quitar comprobante
              </Button>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.beforeSigning}
              onChange={(event) =>
                update({ beforeSigning: event.target.checked })
              }
            />
            Gasto previo a la firma del acuerdo (no suma puntos)
          </label>
          <p className="text-sm text-muted">
            La fecha se registra automáticamente al guardar.
          </p>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || !allowed}>
            {busy ? "Guardando…" : "Registrar gasto"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

interface FieldBaseProps {
  label: string
  error?: string
  hint?: ReactNode
}

const controlClass = (error?: string, className?: string) =>
  cn(
    'min-h-11 w-full rounded-lg border bg-[var(--input)] px-3 text-fg placeholder:text-muted disabled:opacity-60',
    error ? 'border-danger' : 'border-[var(--control-border)]',
    className,
  )

/** Etiqueta, ayuda y error accesibles alrededor de cualquier control de formulario. */
function FieldShell({
  id,
  label,
  error,
  hint,
  children,
}: FieldBaseProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const describedBy = (id: string, error?: string, hint?: ReactNode) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined

export function Field({
  label,
  error,
  hint,
  className,
  id,
  ...props
}: FieldBaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <FieldShell id={inputId} label={label} error={error} hint={hint}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        className={controlClass(error, className)}
        {...props}
      />
    </FieldShell>
  )
}

export function SelectField({
  label,
  error,
  hint,
  className,
  id,
  children,
  ...props
}: FieldBaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <FieldShell id={selectId} label={label} error={error} hint={hint}>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(selectId, error, hint)}
        className={controlClass(error, className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
}

export function TextareaField({
  label,
  error,
  hint,
  className,
  id,
  ...props
}: FieldBaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId()
  const areaId = id ?? autoId
  return (
    <FieldShell id={areaId} label={label} error={error} hint={hint}>
      <textarea
        id={areaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(areaId, error, hint)}
        className={controlClass(error, cn('min-h-24 py-2.5', className))}
        {...props}
      />
    </FieldShell>
  )
}

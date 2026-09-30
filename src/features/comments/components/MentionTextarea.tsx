import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { mentionHandle } from '@/domain/mentions'
import type { Profile } from '@/domain/types'
import { cn } from '@/lib/utils'

interface MentionTextareaProps {
  label: string
  value: string
  onChange: (value: string) => void
  members: Profile[]
  placeholder?: string
  error?: string
  rows?: number
  onBlur?: () => void
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Texto que el usuario está escribiendo como mención justo antes del cursor, si lo hay. */
function pendingMention(text: string, caret: number): { start: number; query: string } | null {
  const match = /(^|\s)@(\p{L}*)$/u.exec(text.slice(0, caret))
  return match ? { start: caret - match[2].length - 1, query: match[2] } : null
}

/**
 * Área de texto que sugiere a los socios al escribir `@`. Sigue el patrón combobox: las sugerencias se
 * recorren con las flechas, Enter o Tab eligen y Escape las cierra; con puntero o toque se eligen tocándolas.
 */
export function MentionTextarea({ label, value, onChange, members, placeholder, error, rows = 3, onBlur }: MentionTextareaProps) {
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  const pending = dismissed ? null : pendingMention(value, caret)
  const options = pending
    ? members.filter((m) => normalize(m.name.split(' ')[0]).startsWith(normalize(pending.query)))
    : []
  const open = options.length > 0

  const pick = (member: Profile) => {
    if (!pending) return
    const insert = `${mentionHandle(member.name)} `
    const next = value.slice(0, pending.start) + insert + value.slice(caret)
    const position = pending.start + insert.length
    onChange(next)
    setCaret(position)
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(position, position)
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((index) => (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      pick(options[active] ?? options[0])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDismissed(true)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        aria-autocomplete="list"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
        className={cn(
          'min-h-24 w-full rounded-lg border bg-surface px-3 py-2.5 text-fg placeholder:text-muted',
          error ? 'border-danger' : 'border-border',
        )}
        onChange={(e) => {
          onChange(e.target.value)
          setCaret(e.target.selectionStart)
          setActive(0)
          setDismissed(false)
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      {open ? (
        <ul id={`${id}-options`} role="listbox" aria-label="Personas a mencionar" className="flex flex-wrap gap-2">
          {options.map((member, index) => (
            <li key={member.id} id={`${id}-option-${index}`} role="option" aria-selected={index === active}>
              <button
                type="button"
                // Evita que la textarea pierda el foco antes de que se registre el toque.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(member)}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm font-medium',
                  index === active
                    ? 'border-primary bg-primary-soft text-primary-text'
                    : 'border-border bg-surface text-fg',
                )}
              >
                {mentionHandle(member.name)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-sm text-muted">
          Escribe @ para mencionar a alguien del equipo.
        </p>
      )}
    </div>
  )
}

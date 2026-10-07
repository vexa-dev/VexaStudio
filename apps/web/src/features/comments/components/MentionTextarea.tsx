import { useId, useRef, useState, type KeyboardEvent } from "react";
import {
  applyMention,
  memberHandle,
  mentionQuery,
  suggestMentions,
  type Mentionable,
} from "@vexa/domain/comments";
import { cn } from "@/lib/utils";

interface MentionTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  members: (Mentionable & { role?: string })[];
  /** Quien escribe; no se le sugiere a sí mismo. */
  authorId?: string;
  maxLength: number;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

/**
 * Cuadro de texto con sugerencias al escribir `@`. Flechas para moverse, Enter o
 * Tab para elegir, Escape para cerrar. La lista usa botones de 44 px para tocar en el celular.
 */
export function MentionTextarea({
  label,
  value,
  onChange,
  members,
  authorId,
  maxLength,
  placeholder,
  error,
  disabled,
}: MentionTextareaProps) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);

  const token = mentionQuery(value, caret);
  const options = token ? suggestMentions(token.query, members, authorId) : [];
  const open = Boolean(token) && options.length > 0 && dismissed !== token?.start;
  const listId = `${id}-options`;

  const choose = (member: Mentionable) => {
    if (!token) return;
    const next = applyMention(value, token, memberHandle(member));
    onChange(next.text);
    setCaret(next.caret);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : options.length - 1;
      setActive((index) => (index + step) % options.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      choose(options[Math.min(active, options.length - 1)]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(token?.start ?? null);
    }
  };

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        aria-controls={open ? listId : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        rows={3}
        maxLength={maxLength}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart);
          setActive(0);
          setDismissed(null);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        className={cn(
          "min-h-24 w-full rounded-lg border bg-[var(--input)] px-3 py-2.5 text-fg placeholder:text-muted disabled:opacity-60",
          error ? "border-danger" : "border-[var(--control-border)]",
        )}
      />
      <output className="sr-only">
        {open ? `${options.length} personas para mencionar` : ""}
      </output>
      {open && (
        <ul
          id={listId}
          aria-label="Personas a mencionar"
          className="absolute inset-x-0 top-full z-20 mt-1 flex max-h-56 flex-col overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-card"
        >
          {options.map((member, index) => (
            <li key={member.id}>
              <button
                type="button"
                tabIndex={-1}
                aria-current={index === active ? "true" : undefined}
                // mousedown evita que el cuadro pierda el foco antes de elegir.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(member)}
                className={cn(
                  "flex min-h-11 w-full items-baseline gap-2 rounded-md px-3 text-left text-sm",
                  index === active && "bg-primary-soft",
                )}
              >
                {member.name}
                <span className="text-muted">@{memberHandle(member)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p id={`${id}-hint`} className={cn("text-sm", error ? "text-danger" : "text-muted")}>
        {error ?? "Escribe @ para mencionar a alguien."}
      </p>
    </div>
  );
}

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import type { Profile } from "@vexa/domain/types";
import { usePopupPosition } from "@/components/ui/usePopupPosition";
import { cn, initials } from "@/lib/utils";

type Participant = Pick<Profile, "id" | "name" | "username" | "avatarUrl">;

function displayName(person: Participant) {
  return person.username || person.name.trim().split(/\s+/)[0];
}

function ParticipantAvatar({ person }: { person: Participant }) {
  const [failedImage, setFailedImage] = useState<string>();
  const className = "size-5 text-[9px]";
  return person.avatarUrl && failedImage !== person.avatarUrl ? (
    <img
      src={person.avatarUrl}
      alt=""
      onError={() => setFailedImage(person.avatarUrl ?? undefined)}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-text",
        className,
      )}
    >
      {initials(displayName(person))}
    </span>
  );
}

const searchable = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function ParticipantPicker({
  people,
  value,
  onChange,
  onBlur,
  disabled,
  loading,
  error,
  showSelected = true,
}: {
  people: Participant[];
  value: string[];
  onChange: (ids: string[]) => void;
  onBlur: () => void;
  disabled: boolean;
  loading: boolean;
  error: boolean;
  showSelected?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const position = usePopupPosition(search, popup, open, 190, 168);
  const show = () => {
    setTarget(search.current?.closest("dialog") ?? document.body);
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      document.getElementById(`${id}-search`)?.focus();
      setOpen(false);
    };
    const outside = (event: Event) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("keydown", escape, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [open, id]);
  const selected = people.filter((person) => value.includes(person.id));
  const available = people.filter((person) => !value.includes(person.id));
  const matches = available.filter((person) =>
    searchable(`${person.name} ${person.username ?? ""}`).includes(
      searchable(query.trim()),
    ),
  );
  const suggestions = query.trim() ? matches : matches.slice(0, 5);
  const add = (personId: string) => {
    onChange([...value, personId]);
    setQuery("");
    document.getElementById(`${id}-search`)?.focus();
    setOpen(false);
  };
  const toggle = (personId: string) =>
    onChange(
      value.includes(personId)
        ? value.filter((item) => item !== personId)
        : [...value, personId],
    );

  return (
    <div ref={root} className="flex flex-col gap-2">
      <label
        id={`${id}-label`}
        htmlFor={`${id}-search`}
        className="text-sm font-semibold"
      >
        Participantes adicionales{" "}
        <span className="font-normal text-muted">(opcional)</span>
      </label>
      <div className="vexa-search">
        <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
        <input
          ref={search}
          id={`${id}-search`}
          type="search"
          placeholder="Buscar participante por nombre…"
          value={query}
          onFocus={show}
          onClick={show}
          onBlur={onBlur}
          onChange={(event) => {
            setQuery(event.target.value);
            show();
          }}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-fg outline-none placeholder:text-muted disabled:opacity-50"
        />
        {selected.length > 0 && (
          <span className="text-xs text-muted">{selected.length}</span>
        )}
      </div>

      {open &&
        target &&
        createPortal(
          <div
            ref={popup}
            id={`${id}-panel`}
            className="rounded-lg border border-border bg-surface text-fg shadow-pop"
            style={{
              ...position,
              position: "fixed",
              maxHeight: position.maxHeight,
              overflowY: "auto",
              zIndex: 10000,
            }}
          >
            {loading ? (
              <output className="block p-3 text-center text-xs text-muted">
                Cargando participantes…
              </output>
            ) : error ? (
              <p role="alert" className="p-3 text-center text-xs text-danger">
                No se pudieron cargar los participantes.
              </p>
            ) : suggestions.length ? (
              <fieldset
                aria-labelledby={`${id}-label`}
                className="flex min-w-0 flex-col p-1"
              >
                {suggestions.map((person) => {
                  return (
                    <button
                      key={person.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => add(person.id)}
                      onBlur={onBlur}
                      aria-label={`Agregar a ${displayName(person)}`}
                      className="flex min-h-8 items-center rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                    >
                      <span className="truncate">{displayName(person)}</span>
                    </button>
                  );
                })}
              </fieldset>
            ) : (
              <output className="block p-3 text-center text-xs text-muted">
                {query.trim()
                  ? "No encontramos a ese participante."
                  : available.length === 0 && people.length > 0
                    ? "Ya agregaste a todos."
                    : "No hay otros miembros activos."}
              </output>
            )}
          </div>,
          target,
        )}

      {showSelected && selected.length > 0 && (
        <div
          className="flex max-h-20 flex-wrap gap-1 overflow-y-auto py-0.5"
          aria-label="Participantes seleccionados"
        >
          {selected.map((person) => (
            <button
              key={person.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(person.id)}
              aria-label={`Quitar a ${displayName(person)}`}
              className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 py-0.5 pl-0.5 pr-2 text-[11px] leading-none transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
            >
              <ParticipantAvatar person={person} />
              <span className="truncate">{displayName(person)}</span>
              <X size={10} aria-hidden="true" className="shrink-0 text-muted" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

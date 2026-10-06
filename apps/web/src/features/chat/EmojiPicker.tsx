import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import "@fontsource-variable/noto-emoji/index.css";
import {
  EMOJI_CATEGORIES,
  RECENT_LIMIT,
  pushRecent,
  searchEmojis,
} from "./emoji-data";
import { toTextPresentation } from "./emoji-text";

const RECENT_KEY = "vexa.chat.recent-emojis";
const RECENT_ID = "recent";

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(RECENT_KEY) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === "string")
          .slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Recents are a convenience; storage may be blocked or full.
  }
}

/** Monochrome emoji picker: curated categories, Spanish search and recents. */
export default function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
}) {
  const [recent, setRecent] = useState(readRecent);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState(() =>
    readRecent().length ? RECENT_ID : EMOJI_CATEGORIES[0].id,
  );
  const [focusIndex, setFocusIndex] = useState(0);
  const grid = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const searching = query.trim().length > 0;
  const category =
    categoryId === RECENT_ID && recent.length
      ? undefined
      : (EMOJI_CATEGORIES.find((item) => item.id === categoryId) ??
        EMOJI_CATEGORIES[0]);
  const visible = useMemo(() => {
    if (searching) return searchEmojis(query).map((entry) => entry.char);
    if (!category) return recent;
    return category.emojis.map((entry) => entry.char);
  }, [searching, query, category, recent]);
  const active = Math.min(focusIndex, Math.max(visible.length - 1, 0));

  function choose(emoji: string) {
    const next = pushRecent(recent, emoji, RECENT_LIMIT);
    setRecent(next);
    writeRecent(next);
    onSelect(emoji);
  }

  function focusCell(index: number) {
    setFocusIndex(index);
    grid.current?.querySelectorAll<HTMLButtonElement>("button")[index]?.focus();
  }

  function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
    const columns =
      getComputedStyle(event.currentTarget).gridTemplateColumns.split(" ")
        .length || 1;
    const last = visible.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: Math.min(active + 1, last),
      ArrowLeft: Math.max(active - 1, 0),
      ArrowDown: Math.min(active + columns, last),
      ArrowUp: Math.max(active - columns, 0),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      focusCell(moves[event.key]);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && onClose) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  const tabs = [
    ...(recent.length ? [{ id: RECENT_ID, label: "Recientes" }] : []),
    ...EMOJI_CATEGORIES.map(({ id, label }) => ({ id, label })),
  ];
  const label = searching
    ? "Resultados"
    : (tabs.find((tab) => tab.id === (category?.id ?? RECENT_ID))?.label ??
      "Emojis");

  return (
    <div
      className="chat-emoji-picker"
      role="presentation"
      onKeyDown={onKeyDown}
    >
      <label className="chat-emoji-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar emoji"
          aria-label="Buscar emoji"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setFocusIndex(0);
          }}
        />
      </label>
      {!searching && (
        <div className="chat-emoji-tabs" role="tablist" aria-label="Categorías">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${panelId}-${tab.id}`}
              aria-selected={tab.id === (category?.id ?? RECENT_ID)}
              aria-controls={panelId}
              onClick={() => {
                setCategoryId(tab.id);
                setFocusIndex(0);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <div
        className="chat-emoji-grid"
        id={panelId}
        role={searching ? "group" : "tabpanel"}
        aria-label={label}
        ref={grid}
        tabIndex={-1}
        onKeyDown={onGridKey}
      >
        {visible.map((emoji, index) => (
          <button
            key={emoji}
            type="button"
            className="chat-emoji"
            tabIndex={index === active ? 0 : -1}
            aria-label={emoji}
            onClick={() => choose(emoji)}
            onFocus={() => setFocusIndex(index)}
          >
            {toTextPresentation(emoji)}
          </button>
        ))}
        {!visible.length && (
          <p className="chat-emoji-none">Ningún emoji coincide.</p>
        )}
      </div>
    </div>
  );
}

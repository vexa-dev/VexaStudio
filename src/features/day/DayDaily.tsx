import { useEffect, useId, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  History,
  Sparkles,
  Sun,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChoicePicker } from "@/features/time/components/TimePickers";
import { formatIsoDate } from "@/lib/dates";
import {
  dailyDates,
  readLocal,
  writeLocal,
  type DailyDraft,
} from "./day-storage";

export function DayTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.max(64, ref.current.scrollHeight)}px`;
    }
  }, [value]);
  return (
    <label className="day-field">
      {label}
      <textarea
        ref={ref}
        rows={2}
        maxLength={2000}
        className="daily-input day-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
function DailyEditor({
  userId,
  date,
  today,
  suggestions,
}: {
  userId: string;
  date: string;
  today: string;
  suggestions: string[];
}) {
  const key = `vexa.daily-draft.${userId}.${date}`;
  const [draft, setDraft] = useState<DailyDraft>(() => {
    const saved = readLocal<DailyDraft>(key, {
      done: "",
      next: "",
      blockers: "",
      needsFrom: "",
    });
    return {
      done: typeof saved.done === "string" ? saved.done : "",
      next: typeof saved.next === "string" ? saved.next : "",
      blockers: typeof saved.blockers === "string" ? saved.blockers : "",
      needsFrom: typeof saved.needsFrom === "string" ? saved.needsFrom : "",
    };
  });
  const [status, setStatus] = useState("Guardado automático en este navegador");
  const latest = useRef(draft);
  const dirty = useRef(false);
  const update = (patch: Partial<DailyDraft>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    dirty.current = true;
    setDraft(next);
    setStatus("Guardando…");
  };
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      const ok = writeLocal(key, latest.current);
      if (ok) dirty.current = false;
      setStatus(
        ok
          ? "Guardado en este navegador"
          : "No se pudo guardar. Conserva el texto antes de salir.",
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [draft, key]);
  useEffect(() => {
    const flush = () => {
      if (dirty.current) writeLocal(key, latest.current);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
    };
  }, [key]);
  function suggest() {
    const lines = suggestions.filter((title) => !draft.done.includes(title));
    if (lines.length)
      update({
        done: [draft.done, ...lines.map((title) => `• ${title}`)]
          .filter(Boolean)
          .join("\n")
          .slice(0, 2000),
      });
  }
  return (
    <div className="day-daily-fields">
      {date === today && suggestions.length > 0 && (
        <button type="button" className="day-text-action" onClick={suggest}>
          <Sparkles size={15} /> Usar trabajo de hoy
        </button>
      )}
      <DayTextarea
        label="¿Qué avanzaste?"
        value={draft.done}
        onChange={(done) => update({ done })}
        placeholder="Cuenta el resultado, aunque aún no tengas una tarea asignada…"
      />
      <DayTextarea
        label="¿Qué sigue?"
        value={draft.next}
        onChange={(next) => update({ next })}
        placeholder="Tu siguiente paso…"
      />
      <DayTextarea
        label="¿Hay algún bloqueo?"
        value={draft.blockers}
        onChange={(blockers) => update({ blockers })}
        placeholder="Sin bloqueos, o explica qué necesitas…"
      />
      {draft.blockers.trim() && (
        <label className="day-field">
          ¿De quién necesitas ayuda? (opcional)
          <input
            className="daily-input"
            maxLength={120}
            value={draft.needsFrom ?? ""}
            onChange={(e) => update({ needsFrom: e.target.value })}
            placeholder="Una persona o el equipo"
          />
        </label>
      )}
      <div className="day-save-status">
        <Check size={14} />
        <output aria-live="polite">{status}</output>
      </div>
      <p className="day-note">
        Borrador personal. Todavía no se comparte con el equipo.
      </p>
    </div>
  );
}
export function DayDaily({
  userId,
  today,
  suggestions,
}: {
  userId: string;
  today: string;
  suggestions: string[];
}) {
  const [date, setDate] = useState(today);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const [history, setHistory] = useState(false);
  return (
    <Card className="day-daily-card">
      <div className="day-card-title">
        <h2>
          <Sun size={18} /> Contar mi avance
        </h2>
        <Button
          variant="ghost"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Cerrar daily" : "Abrir daily"}
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>
      <p className="day-note">
        Tu daily resume lo que avanzaste y si necesitas ayuda. No registra
        horas.
      </p>
      {open && (
        <div id={panelId} className="day-daily-panel">
          <Button
            variant="ghost"
            onClick={() => setHistory((value) => !value)}
            aria-expanded={history}
          >
            <History size={15} /> Historial
          </Button>
          {history && (
            <ChoicePicker
              label="Fecha del daily"
              value={date}
              onChange={setDate}
              options={dailyDates(userId, today).map((value) => ({
                value,
                label:
                  value === today
                    ? `Hoy · ${formatIsoDate(value)}`
                    : formatIsoDate(value),
              }))}
            />
          )}
          {date !== today && (
            <div className="day-history-caption">
              Daily del {formatIsoDate(date)}
              <button
                className="day-text-action"
                onClick={() => setDate(today)}
              >
                Volver a hoy
              </button>
            </div>
          )}
          <DailyEditor
            key={date}
            userId={userId}
            date={date}
            today={today}
            suggestions={suggestions}
          />
        </div>
      )}
    </Card>
  );
}

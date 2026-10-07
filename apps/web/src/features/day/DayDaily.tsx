import { useEffect, useId, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  History,
  Send,
  Sparkles,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { ChoicePicker } from "@/features/time/components/TimePickers";
import type { DailyRecord } from "@vexa/domain/daily";
import { formatDateTime, formatIsoDate } from "@vexa/domain/dates";
import {
  dailyDates,
  readLocal,
  writeLocal,
  type DailyDraft,
} from "./day-storage";
import {
  dailyToDraft,
  draftToDaily,
  isDraftEmpty,
  matchesSent,
} from "./daily-form";
import { useSentDailies, useSubmitDaily, useSuggestDone } from "./hooks/useDaily";

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
  sent,
}: {
  userId: string;
  date: string;
  today: string;
  sent: DailyRecord | undefined;
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
  const submit = useSubmitDaily();
  const suggestion = useSuggestDone();
  // Un daily ya enviado reaparece para corregirlo si este navegador no tiene borrador.
  const adopted = useRef(false);
  useEffect(() => {
    if (adopted.current || !sent || dirty.current) return;
    adopted.current = true;
    if (isDraftEmpty(latest.current)) {
      latest.current = dailyToDraft(sent);
      setDraft(latest.current);
    }
  }, [sent]);
  async function suggest() {
    const text = await suggestion.mutateAsync();
    const lines = text
      .split("\n")
      .filter((line) => line && !latest.current.done.includes(line));
    if (!text) toast.info("No hay horas registradas desde tu último daily.");
    else if (lines.length)
      update({
        done: [latest.current.done, ...lines]
          .filter(Boolean)
          .join("\n")
          .slice(0, 2000),
      });
    else toast.info("Ya incluiste ese trabajo en tu daily.");
  }
  async function send() {
    if (dirty.current && writeLocal(key, latest.current)) dirty.current = false;
    await submit.mutateAsync(draftToDaily(latest.current));
  }
  const unchanged = sent ? matchesSent(draft, sent) : false;
  const canSend =
    date === today &&
    !submit.isPending &&
    !isDraftEmpty(draft) &&
    !unchanged;
  return (
    <div className="day-daily-fields">
      {date === today && (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => void suggest().catch(() => undefined)}
          disabled={suggestion.isPending}
        >
          <Sparkles size={15} />
          {suggestion.isPending ? "Buscando tu trabajo…" : "Autocompletar qué hice"}
        </Button>
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
      {sent && (
        <output className="day-note">
          <Check size={12} aria-hidden="true" /> Enviado el{" "}
          <span className="num">{formatDateTime(sent.updatedAt ?? sent.date)}</span> (Lima).
          {!unchanged && " Tienes cambios sin enviar."}
        </output>
      )}
      {date === today ? (
        <Button
          onClick={() => void send().catch(() => undefined)}
          disabled={!canSend}
        >
          <Send size={16} />
          {submit.isPending
            ? "Enviando…"
            : sent
              ? "Reenviar cambios"
              : "Enviar daily"}
        </Button>
      ) : (
        !sent && (
          <p className="day-note">
            Solo se puede enviar el daily de hoy. Este borrador es personal.
          </p>
        )
      )}
      <p className="day-note">
        {sent
          ? "Tu equipo ve lo que enviaste. Puedes corregirlo hoy."
          : "Hasta que lo envíes, el borrador es personal y queda en este navegador."}
      </p>
    </div>
  );
}
export function DayDaily({
  userId,
  today,
}: {
  userId: string;
  today: string;
}) {
  const sentDailies = useSentDailies(userId);
  const sentByDate = new Map(
    (sentDailies.data ?? []).map((daily) => [daily.date, daily]),
  );
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
              options={dailyDates(userId, today, [...sentByDate.keys()]).map((value) => ({
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
          {sentDailies.isLoading && (
            <output className="day-note">Buscando tu daily enviado…</output>
          )}
          {sentDailies.isError && (
            <ErrorState
              message="No se pudo comprobar si ya enviaste tu daily."
              onRetry={() => void sentDailies.refetch()}
            />
          )}
          <DailyEditor
            key={date}
            userId={userId}
            date={date}
            today={today}
            sent={sentByDate.get(date)}
          />
        </div>
      )}
    </Card>
  );
}

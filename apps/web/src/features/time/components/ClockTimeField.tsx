import "../pages/time.css";
import "./clock-dial.css";
import { Clock } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import {
  formatClockLabel,
  formatClockTime,
  limaInstant,
  parseClockTime,
  type ClockTime,
} from "@vexa/domain/clock";
import { ClockDial } from "./ClockDial";

interface ClockTimeFieldProps {
  label: string;
  /** `HH:mm`, Lima. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Selected date (`YYYY-MM-DD`) and hours, to warn about unfinished ranges. */
  date?: string;
  hours?: number;
  /** End of the user's previous entry: ghost marker plus a one-tap shortcut. */
  target?: ClockTime | null;
  compact?: boolean;
}

const FALLBACK: ClockTime = { hour24: 9, minute: 0 };

/** Soft warning only: the form schema and the service stay the authority. */
function unfinishedHint(
  date: string | undefined,
  time: ClockTime,
  hours?: number,
) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!hours || !Number.isFinite(hours) || hours <= 0) return null;
  const end = limaInstant(date, time).getTime() + hours * 3600000;
  return end > Date.now()
    ? "Con esa hora y esas horas, el registro aún no termina. Debe haber terminado para guardarlo."
    : null;
}

export function ClockTimeField({
  label,
  value,
  onChange,
  error,
  date,
  hours,
  target,
  compact = false,
}: ClockTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const hintId = useId();
  const time = parseClockTime(value) ?? FALLBACK;
  const hint = unfinishedHint(date, time, hours);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    card.current
      ?.querySelector<SVGGElement>(".clock-handle.is-minute")
      ?.focus({ preventScroll: true });
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [open]);

  const trapTab = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || !card.current) return;
    const items = Array.from(
      card.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, [tabindex="0"]',
      ),
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === card.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="hours-picker">
      <span className="hours-picker-label">{label}</span>
      <button
        type="button"
        className="hours-picker-trigger"
        ref={trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${formatClockLabel(time)}`}
        aria-describedby={error || (hint && !compact) ? hintId : undefined}
        onClick={() => {
          setHost(trigger.current?.closest("dialog") ?? document.body);
          setOpen(true);
        }}
      >
        <span className="num">{formatClockLabel(time)}</span>
        <Clock size={16} aria-hidden="true" />
      </button>
      {error ? (
        <p id={hintId} className="text-xs text-danger">
          {error}
        </p>
      ) : hint && !compact ? (
        <p id={hintId} className="clock-field-hint is-warning">
          {hint}
        </p>
      ) : null}
      {target && !compact ? (
        <p className="clock-field-hint">
          Tu último registro terminó a las {formatClockTime(target)}. Acomoda
          las manecillas ahí para encadenar tus horas.{" "}
          <button
            type="button"
            className="clock-use-target"
            onClick={() => onChange(formatClockTime(target))}
          >
            Usar esa hora
          </button>
        </p>
      ) : null}
      {open && host
        ? createPortal(
            <div
              className="clock-layer"
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <div
                ref={card}
                className="clock-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onKeyDown={trapTab}
              >
                <h3 id={titleId} className="hours-picker-label">
                  {label}
                </h3>
                <ClockDial
                  value={time}
                  onChange={(next) => onChange(formatClockTime(next))}
                  target={target}
                />
                {compact && hint && (
                  <p className="clock-field-hint is-warning">{hint}</p>
                )}
                <div className="clock-card-actions">
                  {compact && target && (
                    <Button
                      variant="ghost"
                      onClick={() => onChange(formatClockTime(target))}
                    >
                      Usar último cierre
                    </Button>
                  )}
                  <Button onClick={close}>Listo</Button>
                </div>
              </div>
            </div>,
            host,
          )
        : null}
    </div>
  );
}

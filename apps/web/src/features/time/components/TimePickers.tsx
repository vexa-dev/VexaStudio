import "../pages/time.css";
import { createPortal } from "react-dom";
import { usePopupPosition } from "@/components/ui/usePopupPosition";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatIsoDate, formatMonthLabel, todayLima } from "@vexa/domain/dates";

function Picker({
  label,
  text,
  children,
  calendar = false,
}: {
  label: string;
  text: string;
  children: (close: () => void) => ReactNode;
  calendar?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const position = usePopupPosition(
    trigger,
    popup,
    open,
    304,
    400,
    calendar ? 304 : Infinity,
  );
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [restoreFocus, setRestoreFocus] = useState(false);
  const close = () => {
    setRestoreFocus(true);
    setOpen(false);
  };
  useEffect(() => {
    if (!open && restoreFocus) trigger.current?.focus();
  }, [open, restoreFocus]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      ) {
        setRestoreFocus(false);
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setRestoreFocus(true);
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);
  return (
    <div className="hours-picker" ref={root}>
      <span className="hours-picker-label">{label}</span>
      <button
        type="button"
        className="hours-picker-trigger"
        ref={trigger}
        aria-label={`${label}: ${text}`}
        aria-expanded={open}
        onClick={() => {
          setRestoreFocus(false);
          setTarget(trigger.current?.closest("dialog") ?? document.body);
          setOpen(!open);
        }}
      >
        <span>{text}</span>
        {calendar ? <CalendarDays size={16} /> : <ChevronDown size={16} />}
      </button>
      {open &&
        target &&
        createPortal(
          <div
            ref={popup}
            className={`hours-picker-popup${calendar ? " hours-calendar-popup" : ""}`}
            style={{
              ...position,
              position: "fixed",
              minWidth: 0,
              maxWidth: "none",
              overflowY: "auto",
              zIndex: 10000,
            }}
            aria-label={label}
          >
            {children(close)}
          </div>,
          target,
        )}
    </div>
  );
}
export { ChoicePicker } from "@/components/ui/ChoicePicker";
export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  monthOnly = false,
  allowClear = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  monthOnly?: boolean;
  allowClear?: boolean;
}) {
  const [shown, setShown] = useState(() => (value || todayLima()).slice(0, 7));
  const changeShown = (offset: number) => {
    const [y, m] = shown.split("-").map(Number);
    const date = new Date(
      Date.UTC(y, m - 1 + (monthOnly ? offset * 12 : offset), 1),
    );
    setShown(date.toISOString().slice(0, 7));
  };
  const [year, month] = shown.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const disabled = (date: string) =>
    Boolean((min && date < min) || (max && date > max));
  return (
    <Picker
      label={label}
      text={
        value
          ? monthOnly
            ? formatMonthLabel(value)
            : formatIsoDate(value)
          : "Elegir fecha"
      }
      calendar
    >
      {(close) => (
        <div className="hours-calendar">
          <div className="hours-calendar-heading">
            <button
              type="button"
              aria-label={monthOnly ? "Año anterior" : "Mes anterior"}
              onClick={() => changeShown(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <strong>{monthOnly ? year : formatMonthLabel(shown)}</strong>
            <button
              type="button"
              aria-label={monthOnly ? "Año siguiente" : "Mes siguiente"}
              onClick={() => changeShown(1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {monthOnly ? (
            <div className="hours-calendar-months">
              {Array.from({ length: 12 }, (_, i) => {
                const date = `${year}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <button
                    type="button"
                    key={date}
                    disabled={disabled(date)}
                    aria-pressed={value === date}
                    onClick={() => {
                      onChange(date);
                      close();
                    }}
                  >
                    {formatMonthLabel(date).split(" ")[0]}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="hours-calendar-days">
                {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((day, i) => (
                  <span key={i}>{day}</span>
                ))}
                {Array.from({ length: first }, (_, i) => (
                  <span key={`empty${i}`} />
                ))}
                {Array.from({ length: days }, (_, i) => {
                  const date = `${shown}-${String(i + 1).padStart(2, "0")}`;
                  return (
                    <button
                      type="button"
                      key={date}
                      aria-label={formatIsoDate(date)}
                      aria-pressed={value === date}
                      data-today={date === todayLima() || undefined}
                      disabled={disabled(date)}
                      onClick={() => {
                        onChange(date);
                        close();
                      }}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="hours-calendar-footer">
                {allowClear && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      close();
                    }}
                  >
                    Limpiar
                  </button>
                )}
                <button
                  type="button"
                  disabled={disabled(todayLima())}
                  onClick={() => {
                    onChange(todayLima());
                    close();
                  }}
                >
                  Hoy
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Picker>
  );
}

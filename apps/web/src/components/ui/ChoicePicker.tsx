/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Menú personalizado solicitado; conserva semántica de listbox y teclado. */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import "./choice-picker.css";
import { usePopupPosition } from "./usePopupPosition";

export interface ChoiceOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export function ChoicePicker({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
  disabled = false,
  error,
}: {
  label: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
  hideLabel?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const show = () => {
    setTarget(trigger.current?.closest("dialog") ?? document.body);
    setOpen(true);
  };
  const position = usePopupPosition(trigger, popup, open);
  const close = (restore = true) => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const selected = popup.current?.querySelector<HTMLButtonElement>(
      '[aria-selected="true"]',
    );
    (
      selected ??
      popup.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")
    )?.focus();
    const outside = (e: PointerEvent) => {
      if (
        !trigger.current?.contains(e.target as Node) &&
        !popup.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);
  function keyboard(e: KeyboardEvent<HTMLDivElement>) {
    const buttons = [
      ...(popup.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? []),
    ];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | undefined;
    if (e.key === "ArrowDown") next = (index + 1) % buttons.length;
    if (e.key === "ArrowUp")
      next = (index - 1 + buttons.length) % buttons.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = buttons.length - 1;
    if (next !== undefined) {
      e.preventDefault();
      buttons[next]?.focus();
    }
    if (e.key === "Tab") close();
  }
  return (
    <div className="choice-picker">
      <span
        id={`${id}-label`}
        className={hideLabel ? "sr-only" : "choice-picker-label"}
      >
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        className="choice-picker-trigger"
        aria-label={`${label}: ${options.find((o) => o.value === value)?.label ?? "Seleccionar"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
      >
        <span>
          {options.find((o) => o.value === value)?.label ?? "Seleccionar"}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
      {open &&
        target &&
        createPortal(
          <div
            id={id}
            ref={popup}
            className="choice-picker-popup"
            style={position}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={`${id}-label`}
            onKeyDown={keyboard}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                disabled={o.disabled}
                onClick={() => {
                  onChange(o.value);
                  close();
                }}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={15} aria-hidden="true" />}
              </button>
            ))}
            {!options.length && (
              <p className="px-3 py-4 text-sm text-muted">
                Sin opciones disponibles
              </p>
            )}
          </div>,
          target,
        )}
    </div>
  );
}

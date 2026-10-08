import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/Field";

/** The service stores decimal hours; the form accepts hours and minutes. */
export function DurationField({
  value,
  onChange,
  error,
}: {
  value?: number;
  onChange: (hours: number) => void;
  error?: string;
}) {
  const split = (hours?: number) => {
    if (hours === undefined || !Number.isFinite(hours)) return ["", ""];
    const minutes = Math.round(hours * 60);
    return [String(Math.floor(minutes / 60)), String(minutes % 60)];
  };
  const [parts, setParts] = useState(() => split(value));
  const emitted = useRef(value);
  useEffect(() => {
    if (!Object.is(value, emitted.current)) {
      setParts(split(value));
      emitted.current = value;
    }
  }, [value]);
  const change = (index: number, text: string) => {
    const next = parts.map((part, i) => (i === index ? text : part));
    setParts(next);
    const hours = Number(next[0]);
    const minutes = Number(next[1]);
    const valid =
      next.some(Boolean) &&
      Number.isInteger(hours) &&
      hours >= 0 &&
      Number.isInteger(minutes) &&
      minutes >= 0 &&
      minutes < 60;
    emitted.current = valid ? hours + minutes / 60 : Number.NaN;
    onChange(emitted.current);
  };
  return (
    <div className="hours-duration">
      <div className="hours-duration-inputs">
        <Field
          label="Horas"
          type="number"
          inputMode="numeric"
          min={0}
          max={24}
          step={1}
          placeholder="0"
          value={parts[0]}
          aria-invalid={!!error}
          onChange={(e) => change(0, e.target.value)}
        />
        <Field
          label="Minutos"
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          step={1}
          placeholder="00"
          value={parts[1]}
          aria-invalid={!!error}
          onChange={(e) => change(1, e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

import "./clock-dial.css";
import { Check } from "lucide-react";
import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  angleFromPoint,
  angleToHour12,
  formatClockLabel,
  formatClockTime,
  from12h,
  hourToAngle,
  minuteToAngle,
  parseClockTime,
  snapMinute,
  to12h,
  type ClockTime,
  type Meridiem,
} from "@vexa/domain/clock";

type HandleName = "hour" | "minute";

const VIEW = 240;
const CENTER = VIEW / 2;
const HOUR_RADIUS = 44;
const MINUTE_RADIUS = 90;
const NUMERAL_RADIUS = 70;

const polar = (radius: number, angle: number) => {
  const rad = (angle * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
};

const sameTime = (a: ClockTime, b: ClockTime) =>
  a.hour24 === b.hour24 && a.minute === b.minute;

/** Minute under the pointer: whole minutes, pulled to multiples of five within one minute. */
function magneticMinute(angle: number): number {
  const raw = angle / 6;
  const five = snapMinute(raw, 5);
  const gap = ((((raw - five + 30) % 60) + 60) % 60) - 30;
  return Math.abs(gap) <= 1 ? five : snapMinute(raw, 1);
}

interface ClockDialProps {
  value: ClockTime;
  onChange: (next: ClockTime) => void;
  /** Time to match: draws a ghost marker and celebrates an exact hit. */
  target?: ClockTime | null;
  /** Pixels, kept between 220 and 280. */
  size?: number;
}

export function ClockDial({
  value,
  onChange,
  target,
  size = 240,
}: ClockDialProps) {
  const svg = useRef<SVGSVGElement>(null);
  const hourRef = useRef<SVGGElement>(null);
  const minuteRef = useRef<SVGGElement>(null);
  const grabbed = useRef<HandleName | null>(null);
  const [pulse, setPulse] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [blurredInvalid, setBlurredInvalid] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const { hour12, meridiem } = to12h(value.hour24);
  const hourAngle = hourToAngle(hour12, value.minute);
  const minuteAngle = minuteToAngle(value.minute);
  const hourPoint = polar(HOUR_RADIUS, hourAngle);
  const minutePoint = polar(MINUTE_RADIUS, minuteAngle);
  const exact = Boolean(target && sameTime(value, target));
  const ghost = target
    ? {
        hour: polar(
          HOUR_RADIUS,
          hourToAngle(to12h(target.hour24).hour12, target.minute),
        ),
        minute: polar(MINUTE_RADIUS, minuteToAngle(target.minute)),
      }
    : null;
  const px = Math.min(280, Math.max(220, size));

  const announce = (next: ClockTime) => {
    const hit = target && sameTime(next, target) ? ". Hora exacta" : "";
    setAnnouncement(`${formatClockLabel(next)}${hit}`);
  };
  const commit = (next: ClockTime) => {
    onChange(next);
    announce(next);
  };
  const withHour = (h12: number, m: Meridiem = meridiem): ClockTime => ({
    hour24: from12h(h12, m),
    minute: value.minute,
  });
  const withMinute = (minute: number): ClockTime => ({
    hour24: value.hour24,
    minute,
  });
  const stepHour = (delta: number) =>
    withHour((((hour12 - 1 + delta) % 12) + 12) % 12 + 1);

  const moveTo = (clientX: number, clientY: number) => {
    const el = svg.current;
    const handle = grabbed.current;
    if (!el || !handle) return;
    const rect = el.getBoundingClientRect();
    const angle = angleFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      clientX,
      clientY,
    );
    if (handle === "minute") {
      const minute = magneticMinute(angle);
      if (minute === value.minute) return;
      if (minute % 5 === 0) {
        setPulse((n) => n + 1);
        try {
          navigator.vibrate?.(8);
        } catch {
          /* La vibración es opcional. */
        }
      }
      onChange(withMinute(minute));
    } else {
      const next = angleToHour12(angle, value.minute);
      if (next !== hour12) onChange(withHour(next));
    }
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const el = svg.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scale = rect.width / VIEW;
    const distance = (point: { x: number; y: number }) =>
      Math.hypot(
        rect.left + point.x * scale - event.clientX,
        rect.top + point.y * scale - event.clientY,
      );
    // Empate: gana el minutero.
    grabbed.current =
      distance(hourPoint) < distance(minutePoint) ? "hour" : "minute";
    event.preventDefault();
    el.setPointerCapture(event.pointerId);
    (grabbed.current === "hour" ? hourRef : minuteRef).current?.focus({
      preventScroll: true,
    });
    setDraft(null);
    setBlurredInvalid(false);
    moveTo(event.clientX, event.clientY);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (grabbed.current) moveTo(event.clientX, event.clientY);
  };

  const release = () => {
    if (!grabbed.current) return;
    grabbed.current = null;
    announce(value);
  };

  const onHourKey = (event: KeyboardEvent) => {
    const delta =
      event.key === "ArrowUp" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowDown" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    commit(stepHour(delta));
  };

  const onMinuteKey = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 5 : 1;
    let next: ClockTime | null = null;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowRight":
        next = withMinute(snapMinute(value.minute + step));
        break;
      case "ArrowDown":
      case "ArrowLeft":
        next = withMinute(snapMinute(value.minute - step));
        break;
      case "PageUp":
        next = stepHour(1);
        break;
      case "PageDown":
        next = stepHour(-1);
        break;
      case "Home":
        next = withMinute(0);
        break;
      case "End":
        next = withMinute(59);
        break;
    }
    if (!next) return;
    event.preventDefault();
    commit(next);
  };

  const typed = draft ?? formatClockTime(value);
  const parsed = parseClockTime(typed);
  const showError =
    draft !== null && !parsed && (draft.length >= 5 || blurredInvalid);
  const errorId = "clock-dial-error";

  const numerals = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    return { n, ...polar(NUMERAL_RADIUS, n * 30) };
  });
  const ticks = Array.from({ length: 60 }, (_, m) => {
    const major = m % 5 === 0;
    return {
      m,
      major,
      from: polar(major ? 98 : 102, m * 6),
      to: polar(108, m * 6),
    };
  });

  return (
    <div className="clock-dial" data-exact={exact || undefined}>
      <p className="clock-readout num" aria-live="off">
        {formatClockLabel(value)}
      </p>
      <p className="clock-exact" aria-hidden={!exact} data-on={exact}>
        <Check size={16} aria-hidden="true" />
        <span>Hora exacta</span>
      </p>
      <svg
        ref={svg}
        className="clock-svg"
        style={{ width: px }}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <circle className="clock-face" cx={CENTER} cy={CENTER} r={116} />
        <g aria-hidden="true">
          {ticks.map((t) => (
            <line
              key={t.m}
              className={t.major ? "clock-tick is-major" : "clock-tick"}
              x1={t.from.x}
              y1={t.from.y}
              x2={t.to.x}
              y2={t.to.y}
            />
          ))}
          {numerals.map((n) => (
            <text
              key={n.n}
              className={n.n === hour12 ? "clock-numeral is-now" : "clock-numeral"}
              x={n.x}
              y={n.y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {n.n}
            </text>
          ))}
          {ghost ? (
            <g className="clock-ghost" data-hidden={exact}>
              <circle cx={ghost.hour.x} cy={ghost.hour.y} r={13} />
              <circle cx={ghost.minute.x} cy={ghost.minute.y} r={12} />
            </g>
          ) : null}
          <line
            className="clock-arm is-hour"
            x1={CENTER}
            y1={CENTER}
            x2={hourPoint.x}
            y2={hourPoint.y}
          />
          <line
            className="clock-arm is-minute"
            x1={CENTER}
            y1={CENTER}
            x2={minutePoint.x}
            y2={minutePoint.y}
          />
        </g>
        <g
          ref={hourRef}
          className="clock-handle is-hour"
          role="slider"
          tabIndex={0}
          aria-label="Hora"
          aria-orientation="horizontal"
          aria-valuemin={1}
          aria-valuemax={12}
          aria-valuenow={hour12}
          aria-valuetext={`${hour12} ${meridiem === "am" ? "a. m." : "p. m."}`}
          onKeyDown={onHourKey}
        >
          <circle className="clock-focus" cx={hourPoint.x} cy={hourPoint.y} r={19} />
          <circle className="clock-grip" cx={hourPoint.x} cy={hourPoint.y} r={13} />
          <circle className="clock-touch" cx={hourPoint.x} cy={hourPoint.y} r={24} />
        </g>
        <g
          ref={minuteRef}
          className="clock-handle is-minute"
          role="slider"
          tabIndex={0}
          aria-label="Minutos"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={59}
          aria-valuenow={value.minute}
          aria-valuetext={`${value.minute} ${value.minute === 1 ? "minuto" : "minutos"}`}
          onKeyDown={onMinuteKey}
        >
          <circle className="clock-focus" cx={minutePoint.x} cy={minutePoint.y} r={18} />
          <circle
            key={pulse}
            className={pulse > 0 ? "clock-grip is-pulse" : "clock-grip"}
            cx={minutePoint.x}
            cy={minutePoint.y}
            r={12}
          />
          <circle className="clock-touch" cx={minutePoint.x} cy={minutePoint.y} r={24} />
        </g>
        <circle className="clock-hub" cx={CENTER} cy={CENTER} r={6} />
      </svg>
      <div className="clock-meridiem" role="group" aria-label="Periodo del día">
        {(["am", "pm"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={meridiem === option}
            onClick={() => commit(withHour(hour12, option))}
          >
            {option === "am" ? "a. m." : "p. m."}
          </button>
        ))}
      </div>
      <label className="clock-typed">
        <span>O escríbela (HH:mm, 24 horas)</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={5}
          placeholder="14:30"
          value={typed}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          onChange={(event) => {
            const text = event.target.value.replace(/[^\d:]/g, "");
            setDraft(text);
            setBlurredInvalid(false);
            const next = parseClockTime(text);
            if (next) {
              onChange(next);
              announce(next);
            }
          }}
          onBlur={() => {
            if (parseClockTime(typed)) setDraft(null);
            else if (draft) setBlurredInvalid(true);
            else setDraft(null);
          }}
        />
      </label>
      {showError ? (
        <p id={errorId} className="clock-error">
          Escribe la hora como HH:mm, por ejemplo 14:30.
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

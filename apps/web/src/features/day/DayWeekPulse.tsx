import { BarChart3, Check } from "lucide-react";
import { useId } from "react";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { useTimeHistory } from "@/features/time/hooks/useTime";
import { creditedActivity } from "@/features/time/analytics";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { todayLima, weekRange, formatIsoDate } from "@vexa/domain/dates";
import { formatHours } from "@vexa/domain/format";
import { useSentDailies } from "./hooks/useDaily";

export function DayWeekPulse({ userId, day }: { userId: string; day: string }) {
  const history = useTimeHistory();
  const dailies = useSentDailies(userId);
  const { user } = useAuth();
  const { start, end } = weekRange(`${day}T12:00:00-05:00`);
  const dates = Array.from({ length: 7 }, (_, index) =>
    todayLima(new Date(start.getTime() + index * 86400000)),
  );
  const months = new Map(
    dates.map((date) => {
      const month = date.slice(0, 7);
      return [month, creditedActivity(history.data ?? [], userId, month)];
    }),
  );
  const hours = dates.map(
    (date) => months.get(date.slice(0, 7))!.daily[Number(date.slice(8)) - 1],
  );
  const sent = new Set((dailies.data ?? []).map((record) => record.date));
  const total = hours.reduce((sum, value) => sum + value, 0);
  const maximum = Math.max(1, ...hours);
  const target = user?.weeklyHours ?? 0;
  const sentCount = dates.filter((date) => sent.has(date)).length;
  const gradientId = useId();
  const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const scale = Math.max(2, Math.ceil(maximum / 2) * 2);
  const elapsed = dates.filter((date) => date <= day).length;
  const points = hours
    .slice(0, elapsed)
    .map(
      (value, index) =>
        `${((index + 0.5) * 640) / 7},${86 - (value / scale) * 72}`,
    );
  const line = points.length ? `M ${points.join(" L ")}` : "";
  const area = points.length
    ? `${line} L ${((elapsed - 0.5) * 640) / 7},86 L ${320 / 7},86 Z`
    : "";
  return (
    <Card className="day-week-card">
      <div className="day-week-overview">
        <h2>
          <BarChart3 size={17} /> Tu semana
        </h2>
        <span className="day-note">
          {formatIsoDate(dates[0]).slice(0, 5)} –{" "}
          {formatIsoDate(todayLima(end)).slice(0, 5)}
        </span>
        <strong className="day-week-total">
          {history.isLoading ? "…" : history.isError ? "—" : formatHours(total)}{" "}
          <span>{target > 0 ? `de ${target} h` : "registradas"}</span>
        </strong>
        {target > 0 && (
          <progress
            aria-label="Meta de horas de la semana"
            max={target}
            value={total}
          />
        )}
      </div>
      <div className="day-week-trend">
        <div className="day-week-trend-heading">
          <strong>Horas por día</strong>
          <span>Esta semana</span>
        </div>
        <div className="day-week-plot">
          <div className="day-week-axis">
            <span>{scale} h</span>
            <span>{scale / 2} h</span>
            <span>0 h</span>
          </div>
          <svg
            viewBox="0 0 640 96"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity=".22" />
                <stop
                  offset="100%"
                  stopColor="currentColor"
                  stopOpacity=".02"
                />
              </linearGradient>
            </defs>
            {[14, 50, 86].map((y) => (
              <line
                key={y}
                x1="0"
                x2="640"
                y1={y}
                y2={y}
                className="day-week-gridline"
              />
            ))}
            {elapsed > 0 && !history.isLoading && !history.isError && (
              <>
                <path d={area} fill={`url(#${gradientId})`} />
                <path
                  d={line}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
                {hours.slice(0, elapsed).map((value, index) => (
                  <circle
                    key={dates[index]}
                    cx={((index + 0.5) * 640) / 7}
                    cy={86 - (value / scale) * 72}
                    r="3"
                    className="day-week-point"
                  />
                ))}
              </>
            )}
          </svg>
        </div>
        <div className="day-week-chart" aria-label="Horas registradas por día">
          {dates.map((date, index) => (
            <div
              className="day-week-day"
              key={date}
              data-today={date === day}
              data-future={date > day}
              tabIndex={0}
              data-tooltip={`${formatIsoDate(date)} · ${date > day ? "Por registrar" : history.isLoading || history.isError ? "Horas no disponibles" : formatHours(hours[index])}${sent.has(date) ? " · Avance enviado" : ""}`}
            >
              <span className="day-week-value">
                {history.isLoading || history.isError
                  ? "—"
                  : date > day
                    ? ""
                    : formatHours(hours[index])}
              </span>
              <span className="day-week-label">{labels[index]}</span>
              <span
                className="day-week-sent"
                aria-label={
                  sent.has(date) ? "Avance enviado" : "Sin avance enviado"
                }
              >
                {sent.has(date) ? <Check size={11} /> : <span />}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="day-week-consistency">
        <span className="day-eyebrow">Tus avances</span>
        <strong>
          {dailies.isLoading ? "…" : dailies.isError ? "—" : sentCount}{" "}
          <span>avances enviados</span>
        </strong>
        <div
          className="day-week-checkins"
          aria-label="Avances enviados esta semana"
        >
          {dates.map((date, index) => (
            <div
              key={date}
              data-sent={sent.has(date)}
              data-future={date > day}
              tabIndex={0}
              data-tooltip={`${formatIsoDate(date)} · ${date > day ? "Próximo día" : sent.has(date) ? "Avance enviado" : "Sin avance enviado"}`}
            >
              <span>{labels[index].slice(0, 1)}</span>
              <i>{sent.has(date) ? <Check size={11} /> : "·"}</i>
            </div>
          ))}
        </div>
        <p className="day-note">Un cierre breve para compartir cómo vas.</p>
      </div>
      {history.isError && (
        <ErrorState
          message="No se pudo cargar tu semana."
          onRetry={() => void history.refetch()}
        />
      )}
      {dailies.isError && (
        <ErrorState
          message="No se pudieron cargar los avances."
          onRetry={() => void dailies.refetch()}
        />
      )}
    </Card>
  );
}

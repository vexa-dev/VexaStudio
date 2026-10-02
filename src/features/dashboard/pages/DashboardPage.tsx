import { CalendarOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { CountUp } from "@/components/ui/CountUp";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Meter } from "@/components/ui/Meter";
import { SegmentedBar } from "@/components/ui/SegmentedBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMembers } from "@/features/team/hooks/useMembers";
import { formatMonthLabel, monthKey } from "@/lib/dates";
import { formatHours, formatInt, formatPercent } from "@/lib/format";
import { areaLabel } from "@/lib/labels";
import { useFirstPlay } from "@/lib/useFirstPlay";
import { stagger } from "@/lib/utils";
import { useMonthlySummary, usePoints } from "../hooks/useDashboard";
import { useSettings } from "@/features/settings/hooks/useSettings";

/** Escala del medidor: deja espacio después del mínimo para que las horas extra también se vean. */
const meterMax = (hours: number, minimum: number) =>
  Math.max(minimum * 1.25, hours, 1);

export default function DashboardPage() {
  const { user } = useAuth();
  const [month] = useState(() => monthKey(new Date()));
  const members = useMembers();
  const monthly = useMonthlySummary(month);
  const points = usePoints();
  const settings = useSettings();
  // Barras y contadores se animan la primera vez en la sesión; en las visitas siguientes aparecen ya listos.
  const animate = useFirstPlay("dashboard");

  const isLoading = members.isLoading || monthly.isLoading || points.isLoading;
  const isError = members.isError || monthly.isError || points.isError;
  const firstName = user?.name.split(" ")[0];

  const header = (
    <>
      <header className="quiet-header">
        <div>
          <h1>Hola, {firstName}</h1>
          <p className="quiet-caption">Un mismo horizonte, a tu ritmo.</p>
        </div>
        <div className="quiet-header-actions">
          <span className="quiet-date">{formatMonthLabel(month)}</span>
          <Link to="/proyectos" className="quiet-link">Ver proyectos ↗</Link>
        </div>
      </header>
    </>
  );

  if (isError) {
    return (
      <>
        {header}
        <ErrorState
          message="No se pudo calcular el resumen del mes."
          onRetry={() => {
            void members.refetch();
            void monthly.refetch();
            void points.refetch();
          }}
        />
      </>
    );
  }

  if (isLoading || !members.data || !monthly.data || !points.data || !user) {
    return (
      <>
        {header}
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]" aria-busy="true">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-72 lg:col-span-2" />
        </div>
      </>
    );
  }

  // Tu fila primero: es la que más se consulta desde el celular.
  const partners = members.data
    .filter((m) => monthly.data.some((s) => s.userId === m.id))
    .sort((a, b) => Number(b.id === user.id) - Number(a.id === user.id));
  const totalHours = monthly.data.reduce((sum, s) => sum + s.hours, 0);
  const summaryOf = (id: string) => monthly.data.find((s) => s.userId === id);
  const pointsOf = (id: string) => points.data.find((p) => p.userId === id);

  const mine = summaryOf(user.id);
  const myPoints = pointsOf(user.id);
  const totalPoints = points.data.reduce((sum, p) => sum + p.totalPoints, 0);

  if (totalHours === 0 && totalPoints === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={CalendarOff}
          title="Aún no hay horas este mes"
          description="Cuando el equipo registre horas verás aquí el reparto de participación y el cumplimiento de cada socio."
        />
      </>
    );
  }

  // La barra mantiene el orden del equipo (no el de tu fila) para que cada persona conserve su lugar.
  const segments = members.data
    .filter((m) => pointsOf(m.id))
    .map((m) => ({
      id: m.id,
      label: m.id === user.id ? "Tú" : m.name.split(" ")[0],
      caption: formatPercent(pointsOf(m.id)?.participation ?? 0),
      value: pointsOf(m.id)?.totalPoints ?? 0,
      highlight: m.id === user.id,
    }));
  const shareSummary = `Reparto de participación: ${segments.map((s) => `${s.label} ${s.caption}`).join(", ")}`;

  return (
    <>
      {header}
      <div className="dashboard-summary grid gap-4 lg:grid-cols-2">
        {mine ? (
          <section
            aria-labelledby="tu-mes"
            className="enter"
            style={stagger(1)}
          >
            <Card className="flex h-full flex-col gap-4">
              <h2 id="tu-mes" className="text-base font-semibold">
                Tus horas
              </h2>
              <p className="personal-hours num">
                <strong>{formatHours(mine.hours)}</strong>
                <span> / {formatHours(mine.minimumHours)} este mes</span>
              </p>
              <div className="pb-1">
                <Meter
                  value={mine.hours}
                  max={meterMax(mine.hours, mine.minimumHours)}
                  threshold={mine.minimumHours}
                  label={`${formatHours(mine.hours)} de ${formatHours(mine.minimumHours)} mínimas`}
                  animate={animate}
                />
              </div>
              <p className="text-sm text-muted">
                {mine.meetsMinimum
                  ? mine.hours > mine.minimumHours
                    ? `Ya cumples el mínimo, con ${formatHours(mine.hours - mine.minimumHours)} de más.`
                    : "Justo en el mínimo del mes."
                  : `Te faltan ${formatHours(mine.minimumHours - mine.hours)} para el mínimo.`}{" "}
                Tu compromiso es de {user.weeklyHours} h por semana.
              </p>
            </Card>
          </section>
        ) : null}

        <section aria-labelledby="reparto" className="enter" style={stagger(2)}>
          <Card tone="raised" className="flex h-full flex-col gap-5">
            <h2 id="reparto" className="text-base font-semibold">
              Reparto de participación
            </h2>
            {myPoints ? (
              <div className="flex flex-col gap-1.5">
                <p className="font-display text-2xl font-bold leading-tight sm:text-3xl">
                  Tienes el{" "}
                  <CountUp
                    value={myPoints.participation * 100}
                    format={(v) => `${Math.round(v)} %`}
                    className="num text-primary-text"
                    animate={animate}
                  />{" "}
                  del reparto
                </p>
                <p className="text-sm text-muted">{formatInt(myPoints.totalPoints)} de {formatInt(totalPoints)} puntos del equipo</p>
              </div>
            ) : null}
            <SegmentedBar
              segments={segments}
              summary={shareSummary}
              animate={animate}
            />
            {settings.data ? (
              <details className="text-sm text-muted">
                <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-primary-text">
                  ¿Cómo se calcula?
                </summary>
                {myPoints ? <p className="pb-2">
                  <span className="num">{formatInt(myPoints.totalPoints)}</span>{" "}
                  de <span className="num">{formatInt(totalPoints)}</span>{" "}
                  puntos:{" "}
                  <span className="num">{formatInt(myPoints.hourPoints)}</span>{" "}
                  por horas y{" "}
                  <span className="num">{formatInt(myPoints.moneyPoints)}</span>{" "}
                  por gastos aprobados.
                </p> : null}
                <p className="pb-1">
                  Cada hora validada y no pagada suma{" "}
                  <span className="num">{settings.data.pointsPerHour}</span>{" "}
                  puntos. Cada S/ 1 de gasto aprobado, no reembolsado y
                  posterior a la firma suma{" "}
                  <span className="num">{settings.data.pointsPerSol}</span>. Tu
                  participación es tu parte de los puntos del equipo.
                </p>
              </details>
            ) : null}
          </Card>
        </section>

        <section
          aria-labelledby="equipo"
          className="enter lg:col-span-2"
          style={stagger(3)}
        >
          <Card>
            <h2 id="equipo" className="mb-1 text-base font-semibold">
              El equipo este mes
            </h2>
            <div
              aria-hidden="true"
              className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_5rem_6rem] gap-4 border-b border-border pb-2 text-xs font-medium text-muted sm:grid"
            >
              <span>Socio</span>
              <span>Horas del mes</span>
              <span className="text-right">Puntos</span>
              <span className="text-right">Participación</span>
            </div>
            <ul className="divide-y divide-border">
              {partners.map((member) => {
                const s = summaryOf(member.id);
                const p = pointsOf(member.id);
                if (!s || !p) return null;
                return (
                  <li
                    key={member.id}
                    className="dashboard-member grid gap-x-4 gap-y-2.5 py-3.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_5rem_6rem] sm:items-center"
                  >
                    <div className="dashboard-member-name flex min-w-0 items-center gap-3">
                      <Avatar name={member.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {member.name}
                          {member.id === user.id ? (
                            <span className="text-muted"> (tú)</span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {areaLabel[member.area]}
                        </p>
                      </div>
                    </div>
                    <p className="num text-right text-sm font-semibold sm:hidden"><span className="sr-only">Participación: </span>{formatPercent(p.participation)}</p>
                    <div className="dashboard-member-hours">
                      <Meter
                        value={s.hours}
                        max={meterMax(s.hours, s.minimumHours)}
                        threshold={s.minimumHours}
                        label={`${formatHours(s.hours)} de ${formatHours(s.minimumHours)} mínimas`}
                        className="h-2"
                        animate={animate}
                      />
                      <p className="num mt-1.5 text-xs text-muted">
                        {formatHours(s.hours)} de {formatHours(s.minimumHours)}
                        {s.meetsMinimum
                          ? " · cumple el mínimo"
                          : ` · faltan ${formatHours(s.minimumHours - s.hours)}`}
                      </p>
                    </div>
                    <p className="num hidden text-right text-sm font-semibold sm:block">
                      <span className="sr-only">Puntos: </span>
                      {formatInt(p.totalPoints)}
                    </p>
                    <p className="num hidden text-right text-sm font-semibold sm:block">
                      <span className="sr-only">Participación: </span>
                      {formatPercent(p.participation)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}

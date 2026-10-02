import {
  ArrowUpRight,
  Check,
  Clock3,
  ArrowRight,
  ChartPie,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { CountUp } from "@/components/ui/CountUp";
import { ErrorState } from "@/components/ui/ErrorState";
import { Meter } from "@/components/ui/Meter";
import { SegmentedBar } from "@/components/ui/SegmentedBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMembers } from "@/features/team/hooks/useMembers";
import { formatMonthLabel, monthKey } from "@/lib/dates";
import { formatHours, formatInt, formatPercent } from "@/lib/format";
import { useFirstPlay } from "@/lib/useFirstPlay";
import { stagger } from "@/lib/utils";
import { useMonthlySummary, usePoints } from "../hooks/useDashboard";
import { DashboardOperations } from "./DashboardOperations";
import "./dashboard.css";

export default function DashboardPage() {
  const { user } = useAuth();
  const [month] = useState(() => monthKey(new Date()));
  const members = useMembers();
  const monthly = useMonthlySummary(month);
  const points = usePoints();
  const animate = useFirstPlay("dashboard");
  const isLoading = members.isLoading || monthly.isLoading || points.isLoading;
  const isError = members.isError || monthly.isError || points.isError;

  const header = (
    <header className="dashboard-header">
      <div>
        <p className="dashboard-period">{formatMonthLabel(month)}</p>
        <h1>Hola, {user?.name.split(" ")[0] ?? "socio"}</h1>
        <p className="dashboard-caption">
          Tu avance y el del estudio, en un vistazo.
        </p>
      </div>
      <Link to="/mi-dia" className="dashboard-action dashboard-action-primary">
        Ir a Mi día <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </header>
  );

  if (isError)
    return (
      <div className="studio-dashboard">
        {header}
        <ErrorState
          message="No se pudo calcular el resumen del mes."
          onRetry={() => {
            void members.refetch();
            void monthly.refetch();
            void points.refetch();
          }}
        />
      </div>
    );

  if (isLoading || !members.data || !monthly.data || !points.data || !user)
    return (
      <div className="studio-dashboard">
        {header}
        <div
          className="dashboard-overview dashboard-metrics"
          aria-busy="true"
          aria-label="Cargando resumen"
        >
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <DashboardOperations userId={user?.id ?? ""} />
      </div>
    );

  const summaries = monthly.data;
  const pointSummaries = points.data;
  const summaryOf = (id: string) => summaries.find((s) => s.userId === id);
  const pointsOf = (id: string) => pointSummaries.find((p) => p.userId === id);
  const partners = members.data
    .filter((m) => summaryOf(m.id))
    .sort((a, b) => Number(b.id === user.id) - Number(a.id === user.id));
  const totalHours = summaries.reduce((sum, s) => sum + s.hours, 0);
  const totalPoints = pointSummaries.reduce((sum, p) => sum + p.totalPoints, 0);
  const completed = summaries.filter((s) => s.meetsMinimum).length;
  const mine = summaryOf(user.id);
  const myPoints = pointsOf(user.id);
  const segments = members.data
    .filter((m) => pointsOf(m.id))
    .map((m) => ({
      id: m.id,
      label: m.id === user.id ? "Tú" : m.name.split(" ")[0],
      caption: formatPercent(pointsOf(m.id)?.participation ?? 0),
      value: pointsOf(m.id)?.totalPoints ?? 0,
      highlight: m.id === user.id,
    }));
  const shareSummary = `Participación acumulada: ${segments.map((s) => `${s.label} ${s.caption}`).join(", ")}`;

  const teamPanel = (
    <section
      aria-labelledby="dashboard-team"
      className="dashboard-team-section enter"
      style={stagger(3)}
    >
      <Card className="dashboard-compact-team">
        <div className="dashboard-section-heading">
          <div>
            <h2 id="dashboard-team">El equipo este mes</h2>
            <p>
              {formatHours(totalHours)} registradas · {completed}/
              {partners.length} cumplen el mínimo
            </p>
          </div>
        </div>
        <ul className="dashboard-mini-members">
          {partners.map((member) => {
            const s = summaryOf(member.id);
            if (!s) return null;
            return (
              <li key={member.id}>
                <div className="dashboard-mini-person">
                  <Avatar name={member.name} size="sm" />
                  <span>
                    {member.name.split(" ")[0]}
                    {member.id === user.id ? (
                      <span className="dashboard-you">Tú</span>
                    ) : null}
                  </span>
                </div>
                <div className="dashboard-mini-progress">
                  <span className="num">
                    {formatHours(s.hours)}{" "}
                    <span>/ {formatHours(s.minimumHours)}</span>
                  </span>
                  <Meter
                    value={s.hours}
                    max={Math.max(s.minimumHours, s.hours, 1)}
                    label={`${member.name}: ${formatHours(s.hours)} de ${formatHours(s.minimumHours)} mínimas`}
                    className="h-1"
                    animate={animate}
                  />
                </div>
                <span
                  className={`dashboard-compliance num ${s.meetsMinimum ? "is-complete" : ""}`}
                >
                  {formatPercent(s.compliance)}
                </span>
              </li>
            );
          })}
        </ul>
        <Link to="/equipo" className="dashboard-text-link">
          Ver equipo <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </Card>
    </section>
  );

  return (
    <div className="studio-dashboard">
      {header}
      <div className="dashboard-overview dashboard-metrics">
        {mine ? (
          <section
            aria-labelledby="dashboard-personal"
            className="enter"
            style={stagger(1)}
          >
            <Card className="dashboard-personal-card">
              <div className="dashboard-card-heading">
                <h2 id="dashboard-personal">
                  <span className="dashboard-metric-icon">
                    <Clock3 size={18} aria-hidden="true" />
                  </span>{" "}
                  Tus horas este mes
                </h2>
                <span
                  className={`dashboard-status ${mine.meetsMinimum ? "is-complete" : ""}`}
                >
                  {mine.meetsMinimum ? (
                    <Check size={12} aria-hidden="true" />
                  ) : null}
                  {mine.meetsMinimum ? "Mínimo cumplido" : "En progreso"}
                </span>
              </div>
              <div className="dashboard-personal-main">
                <div>
                  <p className="dashboard-hours num">
                    <CountUp
                      value={mine.hours}
                      format={(v) => String(Number(v.toFixed(2)))}
                      animate={animate}
                    />
                    <span> h</span>
                  </p>
                  <p className="dashboard-caption">
                    de{" "}
                    <strong className="num">
                      {formatHours(mine.minimumHours)}
                    </strong>{" "}
                    mínimas este mes
                  </p>
                </div>
                <div className="dashboard-dial">
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <circle
                      className="dashboard-dial-track"
                      cx="50"
                      cy="50"
                      r="43"
                    />
                    <circle
                      className="dashboard-dial-progress"
                      cx="50"
                      cy="50"
                      r="43"
                      strokeDasharray={2 * Math.PI * 43}
                      strokeDashoffset={
                        2 *
                        Math.PI *
                        43 *
                        (1 - Math.min(Math.max(mine.compliance, 0), 1))
                      }
                    />
                  </svg>
                  <div>
                    <strong className="num">
                      {formatPercent(mine.compliance)}
                    </strong>
                    <span>del mínimo</span>
                  </div>
                </div>
              </div>
              <div className="dashboard-personal-bottom">
                <dl className="dashboard-personal-stats">
                  <div>
                    <dt>
                      {mine.meetsMinimum ? "Sobre el mínimo" : "Por completar"}
                    </dt>
                    <dd className="num">
                      {formatHours(Math.abs(mine.minimumHours - mine.hours))}
                    </dd>
                  </div>
                  <div>
                    <dt>Compromiso semanal</dt>
                    <dd className="num">{formatHours(user.weeklyHours)}</dd>
                  </div>
                </dl>
                <Link to="/horas" className="dashboard-text-link">
                  Ver mis horas <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </Card>
          </section>
        ) : null}

        <section
          aria-labelledby="dashboard-share"
          className="enter"
          style={stagger(2)}
        >
          <Card className="dashboard-share-card">
            <div className="dashboard-card-heading">
              <h2 id="dashboard-share">
                <span className="dashboard-metric-icon">
                  <ChartPie size={18} aria-hidden="true" />
                </span>
                Tu participación
              </h2>
              <span className="dashboard-period-note">Acumulada</span>
            </div>
            {myPoints ? (
              <div className="dashboard-share-value">
                <p className="num">
                  <CountUp
                    value={myPoints.participation * 100}
                    format={(v) => `${Math.round(v)}`}
                    animate={animate}
                  />
                  <span className="dashboard-percentage-unit"> %</span>
                </p>
                <dl className="dashboard-share-points">
                  <div>
                    <dt>Tus puntos</dt>
                    <dd className="num">{formatInt(myPoints.totalPoints)}</dd>
                  </div>
                  <div>
                    <dt>Total del equipo</dt>
                    <dd className="num">{formatInt(totalPoints)}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="dashboard-caption">
                Aún no hay puntos asignados a tu perfil.
              </p>
            )}
            <SegmentedBar
              segments={segments}
              summary={shareSummary}
              animate={animate}
              className="dashboard-share-distribution"
            />
          </Card>
        </section>
      </div>

      <DashboardOperations userId={user.id} team={teamPanel} />
    </div>
  );
}

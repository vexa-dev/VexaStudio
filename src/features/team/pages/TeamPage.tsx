import { ArrowUpRight, MessageSquare, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { buildSeed } from "@/services/mock/seed";
import { areaLabel, roleLabel } from "@/lib/labels";
import { formatIsoDate } from "@/lib/dates";
import { PageHeader } from "@/components/ui/PageHeader";

import { ChoicePicker } from "@/components/ui/ChoicePicker";

export default function TeamPage() {
  const [data] = useState(() => buildSeed(new Date()));
  const [member, setMember] = useState("all");
  const daily = data.dailyUpdates.filter(
    (update) => member === "all" || update.userId === member,
  );
  return (
    <>
      <PageHeader
        title="Equipo"
        description="Cuatro miradas. Una dirección compartida."
        actions={<Badge>Vista con datos de ejemplo</Badge>}
      />
      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.profiles.map((profile) => (
          <Card key={profile.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Avatar name={profile.name} size="lg" />
              <Badge tone={profile.role === "admin" ? "primary" : "neutral"}>
                {roleLabel[profile.role]}
              </Badge>
            </div>
            <div>
              <h2 className="text-base font-semibold">{profile.name}</h2>
              <p className="mt-1 text-xs text-muted">
                {areaLabel[profile.area]}
              </p>
            </div>
            <p className="mt-auto border-t border-border pt-4 text-sm">
              <strong className="num text-xl">{profile.weeklyHours}</strong>
              <span className="text-muted"> h de compromiso semanal</span>
            </p>
          </Card>
        ))}
      </div>
      <Card>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare size={20} /> El pulso del equipo
          </h2>
          <ChoicePicker
            label="Filtrar daily por socio"
            hideLabel
            value={member}
            onChange={setMember}
            options={[
              { value: "all", label: "Todo el equipo" },
              ...data.profiles.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </div>
        <div className="team-dailies grid gap-4">
          {daily.length === 0 ? (
            <div className="day-empty">
              <Users size={24} />
              <p>Este socio no tiene un daily en los datos de ejemplo.</p>
            </div>
          ) : (
            daily.map((update) => (
              <article key={update.id} className="daily-update">
                <div className="mb-4 flex items-center gap-3">
                  <Avatar
                    name={
                      data.profiles.find((p) => p.id === update.userId)?.name ??
                      "Socio"
                    }
                    size="sm"
                  />
                  <strong className="flex-1 text-sm">
                    {data.profiles.find((p) => p.id === update.userId)?.name}
                  </strong>
                  <span className="text-xs text-muted">
                    {formatIsoDate(update.date)}
                  </span>
                </div>
                <dl className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="eyebrow">HICE</dt>
                    <dd className="mt-2 text-sm">{update.done}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow">HARÉ</dt>
                    <dd className="mt-2 text-sm">{update.willDo}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow">BLOQUEOS</dt>
                    <dd className="mt-2 text-sm text-muted">
                      {update.blockers || "Sin bloqueos"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))
          )}
        </div>
        <Link
          to="/mi-dia"
          className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary-text"
        >
          Preparar mi daily <ArrowUpRight size={16} />
        </Link>
        <p className="mt-2 text-xs text-muted">
          Los dailies de ejemplo no incluyen tu borrador local de Mi día.
        </p>
      </Card>
    </>
  );
}

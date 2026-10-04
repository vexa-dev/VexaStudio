import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { Sheet } from "@/components/ui/Sheet";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useMembers } from "@/features/team/hooks/useMembers";
import { DatePicker } from "@/features/time/components/TimePickers";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { categoryLabel, type EventCategory } from "../lib/event-copy";
import {
  ALL,
  EMPTY_FILTERS,
  countActiveFilters,
  type ActivityFilterState,
} from "../lib/filter-state";

interface FiltersProps {
  value: ActivityFilterState;
  onChange: (next: ActivityFilterState) => void;
}

/** Los cinco campos del filtro: persona, proyecto, tipo de evento y rango de fechas. */
function FilterFields({ value, onChange }: FiltersProps) {
  const members = useMembers();
  const projects = useProjects();
  const set = (patch: Partial<ActivityFilterState>) =>
    onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <ChoicePicker
        label="Persona"
        value={value.actorId}
        onChange={(actorId) => set({ actorId })}
        options={[
          { value: ALL, label: "Todas las personas" },
          ...(members.data ?? []).map((m) => ({ value: m.id, label: m.name })),
        ]}
      />
      <ChoicePicker
        label="Proyecto"
        value={value.projectId}
        onChange={(projectId) => set({ projectId })}
        options={[
          { value: ALL, label: "Todos los proyectos" },
          ...(projects.data ?? []).map((p) => ({ value: p.id, label: p.name })),
        ]}
      />
      <ChoicePicker
        label="Tipo de evento"
        value={value.category}
        onChange={(category) =>
          set({ category: category as EventCategory | typeof ALL })
        }
        options={[
          { value: ALL, label: "Todos los eventos" },
          ...(Object.keys(categoryLabel) as EventCategory[]).map((c) => ({
            value: c,
            label: categoryLabel[c],
          })),
        ]}
      />
      <DatePicker
        label="Desde"
        value={value.from}
        max={value.to || undefined}
        onChange={(from) => set({ from })}
      />
      <DatePicker
        label="Hasta"
        value={value.to}
        min={value.from || undefined}
        onChange={(to) => set({ to })}
      />
    </div>
  );
}

/**
 * Filtros de actividad. En escritorio van en una barra sobre la línea de tiempo; en el celular,
 * en una hoja que se abre con el botón "Filtros" (con la cantidad de filtros activos).
 */
export function ActivityFilters({ value, onChange }: FiltersProps) {
  const wide = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const active = countActiveFilters(value);
  const clear = () => onChange(EMPTY_FILTERS);

  if (wide)
    return (
      <Card className="mb-5 flex flex-col gap-3">
        <FilterFields value={value} onChange={onChange} />
        {active > 0 ? (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={clear}>
              Limpiar filtros
            </Button>
          </div>
        ) : null}
      </Card>
    );

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filtros
          {active > 0 ? (
            <Badge tone="primary">
              <span className="num">{active}</span>
              <span className="sr-only">
                {active === 1 ? " filtro activo" : " filtros activos"}
              </span>
            </Badge>
          ) : null}
        </Button>
        {active > 0 ? (
          <Button variant="ghost" onClick={clear}>
            Limpiar
          </Button>
        ) : null}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Filtros">
        <div className="flex flex-col gap-5">
          <FilterFields value={value} onChange={onChange} />
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={clear}>
              Limpiar filtros
            </Button>
            <Button onClick={() => setOpen(false)}>Ver resultados</Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

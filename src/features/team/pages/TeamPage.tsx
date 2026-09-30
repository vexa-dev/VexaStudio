import type { KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'
import { AnnouncementsTab } from '../components/AnnouncementsTab'
import { DailyTab } from '../components/DailyTab'
import { MeetingTab } from '../components/MeetingTab'

const TABS = [
  { id: 'daily', label: 'Daily' },
  { id: 'anuncios', label: 'Anuncios' },
  { id: 'reunion', label: 'Reunión' },
] as const
type TabId = (typeof TABS)[number]['id']

const isTab = (value: string | null): value is TabId => TABS.some((tab) => tab.id === value)

export default function TeamPage() {
  // La pestaña vive en la URL para que los avisos puedan llevar directo al daily o a la reunión.
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const active: TabId = isTab(requested) ? requested : 'daily'

  const select = (id: TabId) => setParams({ tab: id }, { replace: true })
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((tab) => tab.id === active)
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    select(TABS[(next + TABS.length) % TABS.length].id)
  }

  return (
    <>
      <PageHeader title="Equipo" description="Daily asíncrono, anuncios y la reunión semanal." />
      <div
        role="tablist"
        aria-label="Secciones del equipo"
        onKeyDown={onKeyDown}
        className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1 sm:max-w-md"
      >
        {TABS.map((tab) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`team-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls="team-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.id)}
              className={cn(
                'min-h-11 rounded-lg px-2 text-sm font-medium',
                selected ? 'bg-surface font-semibold text-fg shadow-card' : 'text-muted',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div id="team-panel" role="tabpanel" aria-labelledby={`team-tab-${active}`}>
        {active === 'daily' ? <DailyTab /> : active === 'anuncios' ? <AnnouncementsTab /> : <MeetingTab />}
      </div>
    </>
  )
}

import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useMembers } from '@/features/team/hooks/useMembers'
import { useMarkAllRead, useMarkRead, useNotifications } from '../hooks/useNotifications'
import { NotificationList } from './NotificationList'

const RECENT = 8

/** Campana del encabezado: contador de avisos sin leer y hoja con los más recientes. */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const notifications = useNotifications()
  const members = useMembers()
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()

  const list = notifications.data ?? []
  const unread = list.filter((n) => !n.read).length

  return (
    <>
      <Button
        variant="ghost"
        className="relative h-11 w-11 px-0"
        aria-label={unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
        onClick={() => setOpen(true)}
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="num absolute right-1 top-1 flex min-w-[1.125rem] items-center justify-center rounded-full bg-primary-solid px-1 text-xs font-bold leading-[1.125rem] text-primary-fg"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Notificaciones">
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No tienes avisos por ahora.</p>
        ) : (
          <NotificationList
            notifications={list.slice(0, RECENT)}
            members={members.data ?? []}
            onOpen={(n) => {
              if (!n.read) markRead.mutate(n.id)
              setOpen(false)
            }}
          />
        )}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Link
            to="/notificaciones"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center text-sm font-medium text-primary-text"
          >
            Ver todas
          </Link>
          {unread > 0 ? (
            <Button variant="secondary" size="sm" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
              Marcar todas como leídas
            </Button>
          ) : null}
        </div>
      </Sheet>
    </>
  )
}

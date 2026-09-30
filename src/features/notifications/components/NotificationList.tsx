import { useNavigate } from 'react-router-dom'
import type { Notification, Profile } from '@/domain/types'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { describeNotification } from '../notificationText'

interface NotificationListProps {
  notifications: Notification[]
  members: Profile[]
  onOpen: (notification: Notification) => void
}

/** Lista de avisos: cada uno es un botón tocable que marca como leído y lleva a la pantalla que corresponde. */
export function NotificationList({ notifications, members, onOpen }: NotificationListProps) {
  const navigate = useNavigate()
  return (
    <ul className="divide-y divide-border">
      {notifications.map((notification) => {
        const view = describeNotification(notification, members)
        return (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => {
                onOpen(notification)
                navigate(view.to)
              }}
              className="flex min-h-14 w-full items-start gap-3 px-1 py-3 text-left hover:bg-surface-2"
            >
              <span
                aria-hidden="true"
                className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', notification.read ? 'bg-transparent' : 'bg-primary')}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn('text-sm', notification.read ? 'text-muted' : 'font-semibold')}>
                  {!notification.read ? <span className="sr-only">No leída: </span> : null}
                  {view.title}
                </span>
                {view.detail ? <span className="line-clamp-2 text-sm text-muted">{view.detail}</span> : null}
                <span className="num text-xs text-muted">{formatDateTime(notification.createdAt)}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

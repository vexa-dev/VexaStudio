import { BellOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMembers } from '@/features/team/hooks/useMembers'
import { NotificationList } from '../components/NotificationList'
import { useMarkAllRead, useMarkRead, useNotifications } from '../hooks/useNotifications'

export default function NotificationsPage() {
  const notifications = useNotifications()
  const members = useMembers()
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()
  const list = notifications.data ?? []
  const unread = list.filter((n) => !n.read).length

  return (
    <>
      <PageHeader
        title="Notificaciones"
        description="Menciones, votos pendientes, recordatorios y avisos de la reunión."
        actions={
          unread > 0 ? (
            <Button variant="secondary" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
              Marcar todas como leídas
            </Button>
          ) : undefined
        }
      />
      {notifications.isError ? (
        <ErrorState message="No se pudieron cargar tus avisos." onRetry={() => notifications.refetch()} />
      ) : notifications.isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Todo al día"
          description="Cuando alguien te mencione o haya algo por votar, lo verás aquí."
        />
      ) : (
        <Card className="px-4 py-1 sm:px-5 sm:py-1">
          <NotificationList
            notifications={list}
            members={members.data ?? []}
            onOpen={(n) => {
              if (!n.read) markRead.mutate(n.id)
            }}
          />
        </Card>
      )}
    </>
  )
}

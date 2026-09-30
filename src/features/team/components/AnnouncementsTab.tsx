import { zodResolver } from '@hookform/resolvers/zod'
import { Megaphone, Pin, PinOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { TextareaField } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { formatDateTime } from '@/lib/dates'
import { stagger } from '@/lib/utils'
import { useAnnouncements, useCreateAnnouncement, usePinAnnouncement } from '../hooks/useTeam'
import { useMembers } from '../hooks/useMembers'
import { announcementSchema, type AnnouncementFormValues } from '../schemas'

export function AnnouncementsTab() {
  const { user } = useAuth()
  const members = useMembers()
  const announcements = useAnnouncements()
  const create = useCreateAnnouncement()
  const pin = usePinAnnouncement()
  const { register, handleSubmit, reset, formState } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { text: '' },
  })

  const publish = handleSubmit(async ({ text }) => {
    await create.mutateAsync(text)
    reset({ text: '' })
  })
  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <Card tone="raised" className="enter" style={stagger(1)}>
        <form onSubmit={publish} noValidate className="flex flex-col gap-3">
          <TextareaField
            label="Nuevo anuncio"
            placeholder="Algo que todo el equipo debe saber"
            error={formState.errors.text?.message}
            {...register('text')}
          />
          <Button type="submit" className="self-end" disabled={create.isPending}>
            Publicar
          </Button>
        </form>
      </Card>

      {announcements.isError ? (
        <ErrorState message="No se pudieron cargar los anuncios." onRetry={() => announcements.refetch()} />
      ) : announcements.isLoading || !announcements.data ? (
        <Skeleton className="h-32" />
      ) : announcements.data.length === 0 ? (
        <EmptyState icon={Megaphone} title="Aún no hay anuncios" description="Publica el primero para todo el equipo." />
      ) : (
        <ul className="flex flex-col gap-3">
          {announcements.data.map((announcement, index) => (
            <li key={announcement.id} className="enter" style={stagger(index + 2)}>
              <Card className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {announcement.pinned ? (
                    <Badge tone="primary">
                      <Pin className="mr-1 size-3" aria-hidden="true" />
                      Fijado
                    </Badge>
                  ) : null}
                  <p className="text-xs text-muted">
                    {members.data?.find((m) => m.id === announcement.authorId)?.name ?? 'Un socio'} ·{' '}
                    <span className="num">{formatDateTime(announcement.createdAt)}</span>
                  </p>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{announcement.text}</p>
                {isAdmin ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    disabled={pin.isPending}
                    onClick={() => pin.mutate({ id: announcement.id, pinned: !announcement.pinned })}
                  >
                    {announcement.pinned ? (
                      <PinOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Pin className="size-4" aria-hidden="true" />
                    )}
                    {announcement.pinned ? 'Quitar fijado' : 'Fijar arriba'}
                  </Button>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

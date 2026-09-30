import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { extractMentions } from '@/domain/mentions'
import type { CommentEntity, Profile } from '@/domain/types'
import { useMembers } from '@/features/team/hooks/useMembers'
import { formatDateTime } from '@/lib/dates'
import { useAddComment, useComments } from '../hooks/useComments'
import { MentionTextarea } from './MentionTextarea'

const schema = z.object({ text: z.string().trim().min(1, 'Escribe el comentario') })
type Values = z.infer<typeof schema>

/** Texto con las menciones a socios reales resaltadas (por ejemplo, @Rober); el resto se deja tal cual. */
export function MentionText({ text, members }: { text: string; members: Profile[] }) {
  return (
    <>
      {text.split(/(@\p{L}+)/u).map((part, index) =>
        part.startsWith('@') && extractMentions(part, members).length > 0 ? (
          <strong key={index} className="font-semibold text-primary-text">
            {part}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

interface CommentThreadProps {
  entity: CommentEntity
  entityId: string
}

/** Comentarios de una tarea, gasto o registro, con @menciones que avisan a la persona mencionada. */
export function CommentThread({ entity, entityId }: CommentThreadProps) {
  const members = useMembers()
  const comments = useComments(entity, entityId)
  const add = useAddComment(entity, entityId)
  const { control, handleSubmit, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { text: '' },
  })

  const submit = handleSubmit(async ({ text }) => {
    await add.mutateAsync(text)
    reset({ text: '' })
  })
  const people = members.data ?? []

  return (
    <section aria-label="Comentarios" className="flex flex-col gap-4">
      {comments.isLoading ? (
        <Skeleton className="h-16" />
      ) : comments.data && comments.data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {comments.data.map((comment) => {
            const author = people.find((m) => m.id === comment.userId)
            return (
              <li key={comment.id} className="flex gap-3">
                {author ? <Avatar name={author.name} size="sm" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{author?.name.split(' ')[0] ?? 'Alguien'}</span>{' '}
                    <span className="num text-xs text-muted">{formatDateTime(comment.createdAt)}</span>
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    <MentionText text={comment.text} members={people} />
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">Aún no hay comentarios.</p>
      )}

      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Controller
          control={control}
          name="text"
          render={({ field }) => (
            <MentionTextarea
              label="Comentar"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              members={people}
              rows={2}
              error={formState.errors.text?.message}
            />
          )}
        />
        <Button type="submit" className="self-end" disabled={add.isPending}>
          Comentar
        </Button>
      </form>
    </section>
  )
}

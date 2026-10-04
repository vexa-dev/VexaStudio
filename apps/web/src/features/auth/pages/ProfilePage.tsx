import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { MyActivity } from '@/features/activity/components/MyActivity'
import { areaLabel, roleLabel } from '@/lib/labels'
import { useAuth } from '../hooks/useAuth'

export default function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <>
      <PageHeader title="Mi perfil" />
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={user.name} size="lg" />
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-semibold">{user.name}</h2>
          <p className="text-sm text-muted">{areaLabel[user.area]}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge tone="primary">{roleLabel[user.role]}</Badge>
            <Badge>{user.weeklyHours} h/semana</Badge>
          </div>
        </div>
      </Card>
      <MyActivity userId={user.id} />
    </>
  )
}

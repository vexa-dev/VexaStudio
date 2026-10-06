import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Profile } from '@vexa/domain/types'
import { services } from '@/services'

type MediaPatch = { avatarUrl?: string | null; bannerUrl?: string | null }

/** Persists the profile photo/banner (null removes) and refreshes the session and members. */
export function useProfileMedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: MediaPatch) => services.auth.updateProfileMedia(patch),
    onSuccess: (profile: Profile, patch) => {
      queryClient.setQueryData(['auth', 'session'], profile)
      void queryClient.invalidateQueries({ queryKey: ['members'] })
      void queryClient.invalidateQueries({ queryKey: ['team'] })
      const removed = Object.values(patch).includes(null)
      toast.success(removed ? 'Imagen quitada de tu perfil' : 'Imagen guardada en tu perfil')
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la imagen'),
  })
}

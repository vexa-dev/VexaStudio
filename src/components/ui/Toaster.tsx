import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/app/theme'

/**
 * Avisos de confirmación (temporizador detenido, horas guardadas, errores). Toman los colores de los
 * tokens del proyecto y aparecen arriba en el celular para no tapar la barra del temporizador.
 */
export function Toaster() {
  const { theme } = useTheme()
  return (
    <Sonner
      theme={theme}
      position="top-center"
      offset={72}
      mobileOffset={72}
      toastOptions={{
        classNames: {
          toast: '!bg-surface !text-fg !border-border !shadow-pop !font-sans',
          description: '!text-muted',
          actionButton: '!bg-primary-solid !text-primary-fg',
        },
      }}
    />
  )
}

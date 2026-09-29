import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useTheme, type Theme } from './theme'

const order: Theme[] = ['system', 'light', 'dark']
const info = {
  system: { icon: Monitor, label: 'Tema del sistema' },
  light: { icon: Sun, label: 'Tema claro' },
  dark: { icon: Moon, label: 'Tema oscuro' },
}

/** Alterna entre sistema, claro y oscuro. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = order[(order.indexOf(theme) + 1) % order.length]
  const Icon = info[theme].icon
  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-9 px-0"
      aria-label={`${info[theme].label}. Cambiar a ${info[next].label.toLowerCase()}`}
      title={info[theme].label}
      onClick={() => setTheme(next)}
    >
      <Icon className="size-5" aria-hidden="true" />
    </Button>
  )
}

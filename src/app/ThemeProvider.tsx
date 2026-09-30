import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { THEME_KEY, ThemeContext, type Theme } from './theme'

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Sin localStorage: se usa el tema del sistema.
  }
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
      // La barra de estado del navegador toma el color del fondo de la página.
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#0a0a0a' : '#f8fafc')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: Theme) => {
        setThemeState(next)
        try {
          localStorage.setItem(THEME_KEY, next)
        } catch {
          // Se aplica igual en esta sesión.
        }
      },
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

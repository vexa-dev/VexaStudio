import { useEffect, useMemo, useState, type ReactNode } from "react";
import { THEME_KEY, ThemeContext, type Theme } from "./theme";

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
    // Conserva la apariencia anterior al retirar la opción de sistema.
    if (stored === "system")
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  } catch {
    // Sin localStorage: se usa el tema oscuro.
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    const dark = theme === "dark";
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    // La barra de estado del navegador toma el color del fondo de la página.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#0c1017" : "#edf1f5");
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: Theme) => {
        setThemeState(next);
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {
          // Se aplica igual en esta sesión.
        }
      },
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

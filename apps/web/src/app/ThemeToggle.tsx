import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTheme, type Theme } from "./theme";

const info = {
  light: { icon: Sun, label: "Tema claro" },
  dark: { icon: Moon, label: "Tema oscuro" },
};

/** Alterna entre claro y oscuro. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  const Icon = info[theme].icon;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-11 w-11 px-0"
      aria-label={`${info[theme].label}. Cambiar a ${info[next].label.toLowerCase()}`}
      title={info[theme].label}
      onClick={() => setTheme(next)}
    >
      <Icon className="size-5" aria-hidden="true" />
    </Button>
  );
}

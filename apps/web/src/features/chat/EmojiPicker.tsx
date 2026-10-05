import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/app/theme";
import type { EmojiClickEvent } from "emoji-picker-element/shared";
import dataSource from "emoji-picker-element-data/es/cldr/data.json?url";

export default function EmojiPicker({
  onSelect,
}: {
  onSelect: (emoji: string) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const callback = useRef(onSelect);
  const [error, setError] = useState(false);
  const { theme } = useTheme();
  useEffect(() => {
    callback.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    void Promise.all([
      import("emoji-picker-element"),
      import("emoji-picker-element/i18n/es"),
    ])
      .then(([{ Picker }, { default: i18n }]) => {
        if (!active || !mount.current) return;
        const picker = new Picker({ locale: "es", dataSource, i18n });
        picker.className = document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
        const select = (event: EmojiClickEvent) => {
          if (event.detail.unicode) callback.current(event.detail.unicode);
        };
        picker.addEventListener("emoji-click", select);
        mount.current.replaceChildren(picker);
        cleanup = () => {
          picker.removeEventListener("emoji-click", select);
          picker.remove();
        };
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      cleanup?.();
    };
  }, []);
  useEffect(() => {
    const picker = mount.current?.querySelector("emoji-picker");
    if (picker) picker.className = theme;
  }, [theme]);
  return (
    <div className={`chat-emoji-picker ${theme}`} ref={mount}>
      {error && <p>No se pudo abrir el selector de emojis.</p>}
    </div>
  );
}

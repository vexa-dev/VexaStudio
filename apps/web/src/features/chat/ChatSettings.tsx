import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Trash2, Volume2 } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import {
  prepareNotificationSound,
  notificationChime,
} from "@/features/notifications/notification-audio";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ProfileImagePicker } from "@/features/auth/components/ProfileImagePicker";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { isSupabaseSource } from "@/services/supabase/data-source";
import type { ChatSettings as Settings, ChatWallpaper } from "@vexa/domain/chat";
import { WALLPAPER_PRESETS } from "./chat-wallpaper";
import { useWallpaperImage } from "./hooks/useChatData";

const STATUS_PRESETS = [
  "Disponible",
  "Leyendo",
  "Ocupado",
  "En reunión",
  "No molestar",
];

function SettingSwitch({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="profile-preference-row">
      <div>
        <label htmlFor={id}>{title}</label>
        <p>{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-label={title}
        aria-checked={checked}
        className="profile-switch"
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

function WallpaperOption({
  label,
  pressed,
  style,
  onSelect,
}: {
  label: string;
  pressed: boolean;
  style?: React.CSSProperties;
  onSelect: () => void;
}) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onSelect}>
      <span
        className="profile-wallpaper-swatch"
        style={style}
        aria-hidden="true"
      />
      {label}
    </button>
  );
}

/** Per-viewer chat background: presets from the theme or the user's own image. */
function WallpaperSettings({
  wallpaper,
  onChange,
}: {
  wallpaper: ChatWallpaper;
  onChange: (wallpaper: ChatWallpaper) => void;
}) {
  const { user } = useAuth();
  const { image, save, remove } = useWallpaperImage(user?.id ?? "");
  const [picking, setPicking] = useState(false);
  return (
    <>
      <h3>Fondo del chat</h3>
      <p className="profile-help">
        Solo cambia cómo ves tus conversaciones; los demás no lo notan.
      </p>
      <div className="profile-wallpaper-grid">
        <WallpaperOption
          label="Ninguno"
          pressed={wallpaper.kind === "none"}
          onSelect={() => onChange({ kind: "none" })}
        />
        {WALLPAPER_PRESETS.map((preset) => (
          <WallpaperOption
            key={preset.id}
            label={preset.label}
            style={preset.style}
            pressed={wallpaper.kind === "preset" && wallpaper.id === preset.id}
            onSelect={() => onChange({ kind: "preset", id: preset.id })}
          />
        ))}
        {image && (
          <WallpaperOption
            label="Mi imagen"
            style={{ backgroundImage: `url("${image}")` }}
            pressed={wallpaper.kind === "image"}
            onSelect={() => onChange({ kind: "image" })}
          />
        )}
      </div>
      <div className="profile-wallpaper-actions">
        <Button variant="secondary" onClick={() => setPicking(true)}>
          <ImagePlus size={16} aria-hidden="true" />
          Subir imagen
        </Button>
        {image && (
          <Button
            variant="ghost"
            onClick={async () => {
              const removed = await remove();
              if (removed.ok && wallpaper.kind === "image")
                onChange({ kind: "none" });
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            Quitar imagen
          </Button>
        )}
      </div>
      {picking && (
        <ProfileImagePicker
          kind="wallpaper"
          current={null}
          onClose={() => setPicking(false)}
          onApply={async (selection) => {
            // The service explains a rejected image with its own toast.
            const saved = await save(selection.preview);
            if (saved.ok) onChange({ kind: "image" });
          }}
        />
      )}
    </>
  );
}

/** Manually pinned project, shown under the name when no timer is running. */
function CurrentProjectSetting({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (projectId: string | null) => void;
}) {
  const { user } = useAuth();
  const { data: projects = [] } = useProjects();
  const mine = projects.filter((p) => user && p.memberIds?.includes(user.id));
  return (
    <>
      <h3>Proyecto actual</h3>
      <p className="profile-help">
        Se muestra bajo tu nombre cuando no tienes el reloj en marcha.
      </p>
      <ChoicePicker
        label="Proyecto actual"
        value={value ?? ""}
        onChange={(next) => onChange(next === "" ? null : next)}
        options={[
          { value: "", label: "Ninguno" },
          ...mine.map((p) => ({ value: p.id, label: p.name })),
        ]}
      />
    </>
  );
}

export function ChatSettings({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  // Settings round-trip through the service, so the text box keeps its own
  // draft while typing and only follows the saved value when not focused.
  const [statusDraft, setStatusDraft] = useState(settings.status);
  const typing = useRef(false);
  useEffect(() => {
    if (!typing.current) setStatusDraft(settings.status);
  }, [settings.status]);
  const setStatus = (status: string) => {
    setStatusDraft(status);
    onChange({ status });
  };
  return (
    <>
      <h3>Mi estado</h3>
      <p className="profile-help">Comparte en qué estás trabajando.</p>
      <div className="profile-status-presets">
        {STATUS_PRESETS.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={statusDraft === status}
            onClick={() => setStatus(status)}
          >
            {status}
          </button>
        ))}
      </div>
      <Field
        label="Estado personalizado"
        value={statusDraft}
        maxLength={80}
        onFocus={() => {
          typing.current = true;
        }}
        onBlur={() => {
          typing.current = false;
        }}
        onChange={(event) => setStatus(event.target.value)}
        placeholder="Por ejemplo: Leyendo documentación 📚"
      />
      <div className="profile-divider" />
      <h3>Avisos de mensajes</h3>
      <SettingSwitch
        title="Activar avisos de mensajes"
        description="Indicador y sonido al recibir mensajes."
        checked={settings.notifications}
        onChange={(notifications) => onChange({ notifications })}
      />
      <div className="profile-sound-row">
        <ChoicePicker
          label="Sonido de mensajes"
          value={settings.sound}
          onChange={(value) => onChange({ sound: value as Settings["sound"] })}
          options={[
            { value: "soft", label: "Suave" },
            { value: "bell", label: "Campana" },
            { value: "none", label: "Sin sonido" },
          ]}
        />
        <Button
          variant="ghost"
          disabled={settings.sound === "none"}
          onClick={async () => {
            await prepareNotificationSound();
            if (settings.sound !== "none") notificationChime(settings.sound);
          }}
        >
          <Volume2 size={16} aria-hidden="true" />
          Probar sonido
        </Button>
      </div>
      <div className="profile-divider" />
      <CurrentProjectSetting
        value={settings.currentProjectId}
        onChange={(currentProjectId) => onChange({ currentProjectId })}
      />
      <div className="profile-divider" />
      <WallpaperSettings
        wallpaper={settings.wallpaper}
        onChange={(wallpaper) => onChange({ wallpaper })}
      />
      <div className="profile-divider" />
      <h3>Privacidad y conexión</h3>
      <SettingSwitch
        title="Mostrar cuando estoy conectado"
        description="Tu equipo verá que estás en línea mientras la aplicación está abierta."
        checked={settings.presence}
        onChange={(presence) => onChange({ presence })}
      />
      {!isSupabaseSource() && (
        <p className="profile-help">
          Por ahora la mensajería se sincroniza solo entre pestañas del mismo
          navegador. La conexión entre dispositivos llegará con el backend.
        </p>
      )}
    </>
  );
}

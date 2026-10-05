import { Link } from "react-router-dom";
import { Volume2 } from "lucide-react";
import type { Profile } from "@vexa/domain/types";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { Avatar } from "@/components/ui/Avatar";
import {
  prepareNotificationSound,
  notificationChime,
} from "@/features/notifications/notification-audio";
import type { ChatSettings as Settings } from "./chat-store";

export function ChatSettings({
  user,
  settings,
  onChange,
  onClose,
}: {
  user: Profile;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}) {
  return (
    <div className="chat-settings">
      <div className="chat-settings-person">
        <Avatar name={user.name} size="lg" />
        <div>
          <h3>{user.name}</h3>
          <Link to="/perfil" onClick={onClose}>
            Editar mi perfil y foto
          </Link>
        </div>
      </div>
      <section>
        <h3>Mi estado</h3>
        <p className="chat-hint">Comparte en qué estás trabajando.</p>
        <div className="chat-status-presets">
          {[
            "Disponible",
            "Leyendo",
            "Ocupado",
            "En reunión",
            "No molestar",
          ].map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={settings.status === status}
              onClick={() => onChange({ status })}
            >
              {status}
            </button>
          ))}
        </div>
        <Field
          label="Estado personalizado"
          value={settings.status}
          maxLength={80}
          onChange={(event) => onChange({ status: event.target.value })}
          placeholder="Por ejemplo: Leyendo documentación 📚"
        />
      </section>
      <section>
        <h3>Notificaciones</h3>
        <label className="chat-setting-toggle">
          <span>
            Activar avisos de mensajes
            <small>Indicador y sonido al recibir mensajes en esta demo.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.notifications}
            onChange={(event) =>
              onChange({ notifications: event.target.checked })
            }
          />
        </label>
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
      </section>
      <section>
        <h3>Privacidad y conexión</h3>
        <label className="chat-setting-toggle">
          <span>
            Mostrar cuando estoy conectado
            <small>Presencia local mientras la aplicación está abierta.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.presence}
            onChange={(event) => onChange({ presence: event.target.checked })}
          />
        </label>
        <p className="chat-hint">
          Esta etapa sincroniza solo pestañas del mismo navegador. La conexión
          entre dispositivos y la presencia real se añadirán con Supabase.
        </p>
      </section>
    </div>
  );
}

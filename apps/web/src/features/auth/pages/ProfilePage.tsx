import { useId, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bell,
  Camera,
  Check,
  History,
  LockKeyhole,
  Laptop,
  LogOut,
  MessageCircle,
  Plus,
  Smartphone,
  Sparkles,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Profile } from "@vexa/domain/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field, TextareaField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChatSettings } from "@/features/chat/ChatSettings";
import { useChatSettings } from "@/features/chat/hooks/useChatData";
import { MyActivity } from "@/features/activity/components/MyActivity";
import { areaLabel, roleLabel } from "@/lib/labels";
import { useAuth } from "../hooks/useAuth";
import { useProfileMedia } from "../hooks/useProfileMedia";
import { ProfileImagePicker } from "../components/ProfileImagePicker";
import type {
  ProfileImageKind,
  ProfileImageSelection,
} from "../components/profile-image-catalog";
import "./profile.css";

const sections = [
  { id: "personal", label: "Datos personales", icon: UserRound },
  { id: "security", label: "Seguridad", icon: LockKeyhole },
  { id: "preferences", label: "Preferencias", icon: Settings2 },
  { id: "messaging", label: "Mensajería", icon: MessageCircle },
  { id: "activity", label: "Mi actividad", icon: History },
] as const;
type Section = (typeof sections)[number]["id"];

function PreviewFooter({ label = "Guardar cambios" }: { label?: string }) {
  return (
    <div className="profile-footer">
      <p>Vista previa. El guardado estará disponible próximamente.</p>
      <Button disabled>{label}</Button>
    </div>
  );
}

function PreferenceSwitch({
  title,
  description,
  initial = false,
}: {
  title: string;
  description: string;
  initial?: boolean;
}) {
  const [checked, setChecked] = useState(initial);
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
        aria-checked={checked}
        aria-label={title}
        className="profile-switch"
        onClick={() => setChecked(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

/** A saved image only keeps its final crop, so it doubles as the original. */
function savedSelection(
  url: string | null | undefined,
): ProfileImageSelection | null {
  return url ? { original: url, preview: url, zoom: 1, x: 50, y: 50 } : null;
}

function ProfileView({ user }: { user: Profile }) {
  const [mascot, setMascot] = useState<"robot" | "none">("robot");
  const [searchParams, setSearchParams] = useSearchParams();
  const section =
    sections.find((item) => item.id === searchParams.get("seccion"))?.id ??
    "personal";
  function setSection(next: Section) {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next === "personal") params.delete("seccion");
        else params.set("seccion", next);
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  }
  const [name, setName] = useState(user.name);
  const media = useProfileMedia();
  const photo = savedSelection(user.avatarUrl);
  const banner = savedSelection(user.bannerUrl);
  const [imagePicker, setImagePicker] = useState<ProfileImageKind | null>(null);
  const headingId = useId();
  const messagingHeadingId = useId();
  const chatSettings = useChatSettings(user.id);
  return (
    <>
      {imagePicker && (
        <ProfileImagePicker
          kind={imagePicker}
          current={imagePicker === "photo" ? photo : banner}
          onClose={() => setImagePicker(null)}
          onApply={(image) =>
            media.mutate(
              imagePicker === "photo"
                ? { avatarUrl: image.preview }
                : { bannerUrl: image.preview },
            )
          }
        />
      )}
      <PageHeader
        title="Mi perfil"
        description="Tu identidad y tu forma de trabajar en VEXA."
        actions={<Badge>Vista previa</Badge>}
      />
      <Card className="profile-cover-card">
        <div
          className={`profile-cover${banner ? " profile-cover-custom" : ""}`}
        >
          {banner ? (
            <img
              className="profile-cover-image"
              src={banner.preview}
              alt="Tu banner de perfil"
            />
          ) : (
            <div aria-hidden="true">
              <span className="profile-cover-wordmark">VEXA / STUDIO</span>
              <div className="profile-cover-orbit" />
              <span className="profile-cover-caption">
                TU ESPACIO. TU RITMO.
              </span>
            </div>
          )}
          <button
            type="button"
            className="profile-cover-edit"
            aria-label="Elegir o ajustar banner"
            onClick={() => setImagePicker("banner")}
          />
          <div className="profile-cover-actions">
            <Button
              variant="secondary"
              title="JPG, PNG o WebP · máximo 10 MB"
              onClick={() => setImagePicker("banner")}
            >
              <Camera size={16} aria-hidden="true" />
              {banner ? "Cambiar banner" : "Subir banner"}
            </Button>
            {banner && (
              <Button
                variant="secondary"
                disabled={media.isPending}
                onClick={() => media.mutate({ bannerUrl: null })}
              >
                Quitar banner
              </Button>
            )}
          </div>
        </div>
        <div className="profile-identity">
          <button
            type="button"
            className="profile-avatar profile-avatar-edit"
            aria-label="Elegir o ajustar foto de perfil"
            onClick={() => setImagePicker("photo")}
          >
            <Avatar
              name={name || user.name}
              src={user.avatarUrl}
              size="lg"
              className="profile-initials"
            />
          </button>
          <div className="profile-identity-details">
            <h2>{name || user.name}</h2>
            <p>{areaLabel[user.area]}</p>
            <Badge tone="primary">{roleLabel[user.role]}</Badge>
          </div>
          <div className="profile-commitment">
            <span>Compromiso semanal</span>
            <strong className="num">
              {user.weeklyHours} <small>h</small>
            </strong>
          </div>
        </div>
      </Card>
      <div className="profile-layout">
        <aside className="profile-sidebar">
          <nav className="profile-nav" aria-label="Apartados del perfil">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={section === id}
                onClick={() => setSection(id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>
        <div className="profile-content">
          <div className="profile-preview-note">
            <Settings2 size={17} aria-hidden="true" />
            <p>
              Tu foto y tu banner se guardan al aplicarlos. Los ajustes de
              Mensajería también se guardan. Los demás datos y preferencias son
              una vista previa y no se guardan todavía.
            </p>
          </div>
          <section aria-labelledby={headingId} hidden={section !== "personal"}>
            <Card className="profile-panel">
              <div className="profile-section-heading">
                <span>01 / IDENTIDAD</span>
                <h2 id={headingId}>Datos personales</h2>
                <p>Así te verá tu equipo en el espacio de trabajo.</p>
              </div>
              <div className="profile-photo-row">
                <div>
                  <h3>Foto de perfil</h3>
                  <p>Una imagen que ayude a reconocerte.</p>
                  <p>JPG, PNG o WebP · máximo 5 MB</p>
                </div>
                <div className="profile-photo-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setImagePicker("photo")}
                  >
                    <Camera size={16} aria-hidden="true" />
                    {photo ? "Cambiar foto" : "Elegir foto"}
                  </Button>
                  {photo && (
                    <Button
                      variant="ghost"
                      disabled={media.isPending}
                      onClick={() => media.mutate({ avatarUrl: null })}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
              </div>
              <div className="profile-fields">
                <Field
                  label="Nombre visible"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  autoComplete="off"
                  hint="El nombre que aparecerá en tareas y proyectos."
                />
                <Field
                  label="Nombre de usuario"
                  placeholder="Tu nombre de usuario"
                  autoComplete="off"
                  maxLength={30}
                  hint="Un identificador único para tu perfil."
                />
                <div className="profile-full">
                  <Field
                    label="Correo electrónico"
                    type="email"
                    placeholder="tu@correo.com"
                    autoComplete="off"
                    hint="El correo actual se mostrará cuando conectemos tu cuenta."
                  />
                </div>
                <div className="profile-full">
                  <TextareaField
                    label="Sobre mí"
                    placeholder="Tu especialidad, en qué trabajas o cómo puedes ayudar al equipo…"
                    maxLength={280}
                    hint="Una presentación breve, de hasta 280 caracteres."
                  />
                </div>
              </div>
              <div className="profile-account-info">
                <ShieldCheck size={18} aria-hidden="true" />
                <p>
                  Tu rol, área y compromiso semanal los administra el equipo.
                </p>
              </div>
              <PreviewFooter />
            </Card>
          </section>
          <section aria-label="Seguridad" hidden={section !== "security"}>
            <Card className="profile-panel">
              <div className="profile-section-heading">
                <span>02 / CUENTA</span>
                <h2>Seguridad</h2>
                <p>Gestiona el acceso a tu espacio de trabajo.</p>
              </div>
              <h3>Cambiar contraseña</h3>
              <p className="profile-help">
                Estos campos se habilitarán al conectar la gestión de tu cuenta.
              </p>
              <div className="profile-fields">
                <div className="profile-full">
                  <Field
                    label="Contraseña actual"
                    type="password"
                    placeholder="Tu contraseña actual"
                    disabled
                  />
                </div>
                <Field
                  label="Nueva contraseña"
                  type="password"
                  placeholder="Crea una contraseña segura"
                  disabled
                />
                <Field
                  label="Confirmar contraseña"
                  type="password"
                  placeholder="Repite la nueva contraseña"
                  disabled
                />
              </div>
              <PreviewFooter label="Actualizar contraseña" />
            </Card>
            <Card className="profile-panel profile-security-card">
              <div className="profile-section-title">
                <ShieldCheck size={21} aria-hidden="true" />
                <div>
                  <h3>Verificación en dos pasos</h3>
                  <p className="profile-help">
                    Añade un código de tu aplicación de autenticación al iniciar
                    sesión.
                  </p>
                </div>
                <Badge>Vista previa</Badge>
              </div>
              <div className="profile-security-action">
                <div>
                  <strong>Aplicación de autenticación</strong>
                  <p>
                    Google Authenticator, Microsoft Authenticator o similar.
                  </p>
                </div>
                <Button variant="secondary" disabled>
                  Configurar verificación
                </Button>
              </div>
              <div className="profile-security-action">
                <div>
                  <strong>Códigos de recuperación</strong>
                  <p>Para recuperar el acceso si pierdes tu dispositivo.</p>
                </div>
                <Button variant="ghost" disabled>
                  Ver códigos
                </Button>
              </div>
            </Card>
            <Card className="profile-panel profile-security-card">
              <div className="profile-section-heading">
                <h2>Dispositivos y sesiones</h2>
                <p>
                  Consulta dónde has iniciado sesión y controla tus accesos.
                </p>
              </div>
              <p className="profile-session-note">
                Datos de ejemplo para mostrar la vista. No representan tus
                sesiones reales.
              </p>
              <div className="profile-device">
                <Laptop size={24} aria-hidden="true" />
                <div>
                  <h3>Equipo de escritorio</h3>
                  <p>Chrome · Windows · Lima, Perú</p>
                  <span>Última actividad: hace unos minutos · ejemplo</span>
                </div>
                <Badge>Esta sesión · ejemplo</Badge>
                <Button variant="ghost" disabled>
                  <LogOut size={16} aria-hidden="true" />
                  Cerrar sesión
                </Button>
              </div>
              <div className="profile-device">
                <Smartphone size={24} aria-hidden="true" />
                <div>
                  <h3>Teléfono móvil</h3>
                  <p>Safari · iOS · Lima, Perú</p>
                  <span>Última actividad: ayer · ejemplo</span>
                </div>
                <Button variant="secondary" disabled>
                  <LogOut size={16} aria-hidden="true" />
                  Cerrar sesión
                </Button>
              </div>
              <div className="profile-footer">
                <p>
                  Los controles de sesiones se habilitarán al conectar tu
                  cuenta.
                </p>
                <Button variant="secondary" disabled>
                  Cerrar las otras sesiones
                </Button>
              </div>
            </Card>
          </section>
          <section aria-label="Preferencias" hidden={section !== "preferences"}>
            <Card className="profile-panel">
              <div className="profile-section-heading">
                <span>03 / A TU MANERA</span>
                <h2>Preferencias</h2>
                <p>Elige tu compañía y los avisos de tu jornada.</p>
              </div>
              <h3>Tu mascota</h3>
              <p className="profile-help">
                Una pequeña compañía para tu espacio de trabajo. Pronto tendrás
                más personajes para elegir.
              </p>
              <div className="profile-mascot-options">
                <button
                  type="button"
                  aria-pressed={mascot === "robot"}
                  onClick={() => setMascot("robot")}
                >
                  <div className="profile-mascot-art">
                    <img src="/mascot/vexa-robot.png" alt="" />
                  </div>
                  <strong>Robot VEXA</strong>
                  <span>Tu compañero de siempre</span>
                  {mascot === "robot" && (
                    <Check
                      className="profile-mascot-check"
                      size={18}
                      aria-hidden="true"
                    />
                  )}
                </button>
                <button
                  type="button"
                  aria-pressed={mascot === "none"}
                  onClick={() => setMascot("none")}
                >
                  <div className="profile-mascot-art">
                    <Sparkles size={36} aria-hidden="true" />
                  </div>
                  <strong>Sin mascota</strong>
                  <span>Un espacio más tranquilo</span>
                  {mascot === "none" && (
                    <Check
                      className="profile-mascot-check"
                      size={18}
                      aria-hidden="true"
                    />
                  )}
                </button>
                <button
                  type="button"
                  disabled
                  className="profile-mascot-coming"
                >
                  <div className="profile-mascot-art">
                    <Plus size={32} aria-hidden="true" />
                  </div>
                  <strong>Más compañeros</strong>
                  <span>Próximamente</span>
                </button>
              </div>
              <p className="profile-help profile-mascot-note">
                Selección de ejemplo; tu mascota actual no cambia todavía.
              </p>
              <div className="profile-divider" />
              <h3 className="flex flex-wrap items-center gap-2">
                <Bell size={17} aria-hidden="true" />
                Avisos y recordatorios <Badge>Vista previa</Badge>
              </h3>
              <PreferenceSwitch
                title="Nuevas asignaciones"
                description="Un aviso cuando recibas una tarea."
                initial
              />
              <PreferenceSwitch
                title="Recordatorio de horas"
                description="Recuerda confirmar tus horas al terminar el día."
                initial
              />
              <PreferenceSwitch
                title="Resumen semanal"
                description="Tu avance y próximos pendientes en un solo correo."
              />
              <PreviewFooter label="Guardar preferencias" />
            </Card>
          </section>
          <section
            aria-labelledby={messagingHeadingId}
            hidden={section !== "messaging"}
          >
            <Card className="profile-panel">
              <div className="profile-section-heading">
                <span>04 / COMUNICACIÓN</span>
                <h2 id={messagingHeadingId}>Mensajería</h2>
                <p>Tu estado, los avisos y tu presencia en el chat.</p>
              </div>
              {chatSettings.settings ? (
                <ChatSettings
                  settings={chatSettings.settings}
                  onChange={(patch) => void chatSettings.update(patch)}
                />
              ) : chatSettings.query.isError ? (
                <ErrorState
                  title="No se pudieron cargar los ajustes"
                  message={chatSettings.query.error.message}
                  onRetry={() => void chatSettings.query.refetch()}
                />
              ) : (
                <output
                  className="flex flex-col gap-3"
                  aria-label="Cargando ajustes de mensajería"
                >
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </output>
              )}
            </Card>
          </section>
          {section === "activity" && (
            <section aria-label="Mi actividad">
              <MyActivity userId={user.id} />
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  return user ? <ProfileView key={user.id} user={user} /> : null;
}

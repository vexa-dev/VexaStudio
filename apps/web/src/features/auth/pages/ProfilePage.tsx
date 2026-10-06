import { useId, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bell,
  Camera,
  Check,
  History,
  LockKeyhole,
  MessageCircle,
  Plus,
  Sparkles,
  Settings2,
  UserRound,
} from "lucide-react";
import type { Profile } from "@vexa/domain/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChatSettings } from "@/features/chat/ChatSettings";
import { useChatSettings } from "@/features/chat/hooks/useChatData";
import { MyActivity } from "@/features/activity/components/MyActivity";
import { areaLabel, roleLabel } from "@/lib/labels";
import { useAuth } from "../hooks/useAuth";
import { useProfileMedia } from "../hooks/useProfileMedia";
import { NotificationPrefs } from "../components/NotificationPrefs";
import { PersonalDataForm } from "../components/PersonalDataForm";
import { ProfileImagePicker } from "../components/ProfileImagePicker";
import { SecuritySection } from "../components/SecuritySection";
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
              data-tooltip="JPG, PNG o WebP · máximo 10 MB"
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
              name={user.name}
              src={user.avatarUrl}
              size="lg"
              className="profile-initials"
            />
          </button>
          <div className="profile-identity-details">
            <h2>{user.name}</h2>
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
              Tu foto y tu banner se guardan al aplicarlos. Tus datos,
              seguridad, avisos y los ajustes de Mensajería se guardan con
              su propio botón.
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
              <PersonalDataForm user={user} />
            </Card>
          </section>
          <section aria-label="Seguridad" hidden={section !== "security"}>
            <SecuritySection />
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
                Avisos y recordatorios
              </h3>
              <NotificationPrefs />
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

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  Circle,
  Clock,
  FolderOpen,
  Radio,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Profile } from "@vexa/domain/types";
import { Avatar } from "@/components/ui/Avatar";
import {
  profileChips,
  profileFacts,
  type ProfileFactKey,
} from "./profile-facts";
import { defaultBannerFor } from "./thread-identity";
import { useWorkingNow } from "./useWorkingNow";
import type { WorkingNow } from "./working-now";
import "./chat-profile.css";

const DEFAULT_STATUS = "Disponible";
/** Matches the exit animation in chat-profile.css. */
const EXIT_MS = 220;

const FACT_ICONS: Record<ProfileFactKey, LucideIcon> = {
  weekly: Clock,
  since: CalendarDays,
  account: BadgeCheck,
  presence: Radio,
};

function workingLine(working: WorkingNow | null | undefined): string | null {
  if (!working?.projectName) return null;
  if (working.source === "manual") return `Trabaja en ${working.projectName}`;
  return working.taskTitle
    ? `Desarrollando ${working.projectName} · ${working.taskTitle}`
    : `Desarrollando ${working.projectName}`;
}

/**
 * Non-modal profile panel that slides over the conversation pane. It must be
 * rendered inside the positioned `.chat-conversation` section.
 */
export function ChatProfilePanel({
  member,
  open,
  status,
  currentProjectId,
  online,
  fileCount,
  onOpenFiles,
  onClose,
}: {
  /** The person to show. Keep it set while `open` is false so the exit can play. */
  member: Profile | null;
  open: boolean;
  /** Free-text status from the person's chat settings. */
  status: string | undefined;
  currentProjectId: string | null;
  /** Already filtered by the person's presence setting. */
  online: boolean;
  /** Photos, videos, documents and links shared in the conversation. */
  fileCount: number;
  onOpenFiles: () => void;
  onClose: () => void;
}) {
  const working = useWorkingNow(member?.id ?? "", currentProjectId);
  const [mounted, setMounted] = useState(open);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // Stay mounted until the exit animation ends.
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Remember who opened the panel and hand focus back on close.
  useEffect(() => {
    if (!open) return;
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => {
      const element = opener.current;
      opener.current = null;
      if (element?.isConnected) element.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open && mounted) closeButton.current?.focus();
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!member || !mounted) return null;

  const state = open ? "open" : "closed";
  const note = (status ?? DEFAULT_STATUS).trim();
  const line = workingLine(working.data);
  const banner = member.bannerUrl || defaultBannerFor(member.id);
  const chips = profileChips(member);
  return (
    <>
      <div
        className="chat-profile-scrim"
        data-state={state}
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        className="chat-profile-panel"
        data-state={state}
        aria-label={`Perfil de ${member.name}`}
      >
        <header className="chat-profile-bar">
          <button
            ref={closeButton}
            type="button"
            className="chat-profile-close"
            aria-label="Cerrar perfil"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <h3>Info. del perfil</h3>
        </header>
        <div className="chat-profile-scroll">
          <div className="chat-profile-hero">
            <div className="chat-profile-banner-wrap">
              <img
                src={banner}
                alt=""
                className={`chat-profile-banner${member.bannerUrl ? "" : " is-default"}`}
              />
            </div>
            {note && (
              <p className="chat-profile-note">
                <span className="sr-only">Estado: </span>
                <span className="chat-profile-note-text">{note}</span>
                <i aria-hidden="true" className="chat-profile-tail-a" />
                <i aria-hidden="true" className="chat-profile-tail-b" />
              </p>
            )}
            <div className="chat-profile-avatar-wrap">
              <Avatar
                name={member.name}
                src={member.avatarUrl}
                className="chat-profile-avatar"
              />
              <i
                className={`chat-profile-dot${online ? " is-online" : ""}`}
                aria-hidden="true"
              />
              <span className="sr-only">
                {online ? "En línea" : "Sin conexión"}
              </span>
            </div>
          </div>
          <div className="chat-profile-body">
            <p className="chat-profile-name">{member.name}</p>
            <ul className="chat-profile-chips" aria-label="Rol y área">
              <li>{chips.role}</li>
              <li>{chips.area}</li>
            </ul>
            {line && (
              <p className="chat-profile-working">
                {working.data?.source === "timer" && (
                  <Circle
                    size={8}
                    fill="currentColor"
                    aria-hidden="true"
                    className="chat-profile-working-dot"
                  />
                )}
                <span>{line}</span>
              </p>
            )}
            <ul className="chat-profile-facts">
              {profileFacts(member, { online }).map((fact) => {
                const Icon = FACT_ICONS[fact.key];
                return (
                  <li key={fact.key}>
                    <Icon size={18} aria-hidden="true" />
                    <div>
                      <span className="chat-profile-fact-label">
                        {fact.label}
                      </span>
                      <span className="chat-profile-fact-value">
                        {fact.value}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="chat-profile-files"
              onClick={onOpenFiles}
            >
              <FolderOpen size={18} aria-hidden="true" />
              <span>Multimedia, enlaces y documentos</span>
              <span className="chat-profile-files-count num">{fileCount}</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

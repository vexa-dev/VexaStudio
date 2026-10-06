import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Download, Link2, Play, X } from "lucide-react";
import { formatDate } from "@vexa/domain/dates";
import { ATTACHMENT_KINDS, formatBytes } from "./attachment-kinds";
import { KIND_ICONS } from "./AttachMenu";
import { ChatMediaViewer } from "./ChatMediaViewer";
import {
  groupByMonth,
  type SharedFile,
  type SharedLink,
  type SharedMedia,
} from "./shared-media";
import "./chat-profile.css";
import "./chat-files.css";

/** Matches the exit animation in chat-profile.css. */
const EXIT_MS = 220;

type TabId = "media" | "documents" | "links";

const KIND_LABELS = Object.fromEntries(
  ATTACHMENT_KINDS.map((kind) => [kind.id, kind.label]),
) as Record<string, string>;

const EMPTY: Record<TabId, { title: string; hint: string }> = {
  media: {
    title: "Aún no hay fotos ni videos",
    hint: "Las fotos y videos que se envíen en esta conversación aparecerán aquí.",
  },
  documents: {
    title: "Aún no hay documentos",
    hint: "Los documentos, comprimidos y diseños enviados aparecerán aquí.",
  },
  links: {
    title: "Aún no hay enlaces",
    hint: "Los enlaces que se compartan en los mensajes aparecerán aquí.",
  },
};

function Months<T extends { sentAt: number }>({
  items,
  children,
}: {
  items: T[];
  children: (item: T) => ReactNode;
}) {
  return groupByMonth(items).map((group) => (
    <section key={group.key} className="chat-files-month">
      <h4>{group.label}</h4>
      <ul className="chat-files-list">{group.items.map(children)}</ul>
    </section>
  ));
}

function MediaGrid({
  items,
  onOpen,
}: {
  items: SharedFile[];
  onOpen: (index: number) => void;
}) {
  return (
    <>
      {groupByMonth(items).map((group) => (
        <section key={group.key} className="chat-files-month">
          <h4>{group.label}</h4>
          <ul className="chat-files-grid">
            {group.items.map((item) => (
              <li key={item.messageId + item.name}>
                <button
                  type="button"
                  className="chat-files-thumb"
                  aria-label={`${item.kind === "video" ? "Reproducir video" : "Ver foto"} ${item.name}, ${formatDate(new Date(item.sentAt))}`}
                  onClick={() => onOpen(items.indexOf(item))}
                >
                  {item.kind === "video" ? (
                    <>
                      <video
                        src={`${item.data}#t=0.001`}
                        preload="metadata"
                        muted
                        playsInline
                        tabIndex={-1}
                      />
                      <span className="chat-files-play" aria-hidden="true">
                        <Play size={16} fill="currentColor" />
                      </span>
                    </>
                  ) : (
                    <img src={item.data} alt="" loading="lazy" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function DocumentRow({ item }: { item: SharedFile }) {
  const Icon = KIND_ICONS[item.kind];
  return (
    <li className="chat-files-row">
      <span className="chat-files-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <span className="chat-files-text">
        <strong>{item.name}</strong>
        <small>
          {KIND_LABELS[item.kind] ?? "Archivo"} · {formatBytes(item.bytes)} ·{" "}
          {formatDate(new Date(item.sentAt))}
        </small>
      </span>
      <a
        className="chat-files-action"
        href={item.data}
        download={item.name}
        aria-label={`Descargar ${item.name}`}
      >
        <Download size={18} aria-hidden="true" />
      </a>
    </li>
  );
}

function LinkRow({ item }: { item: SharedLink }) {
  return (
    <li>
      <a
        className="chat-files-row chat-files-link"
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="chat-files-icon" aria-hidden="true">
          <Link2 size={20} />
        </span>
        <span className="chat-files-text">
          <strong>{item.host}</strong>
          <small className="chat-files-url">{item.url}</small>
          <small>{formatDate(new Date(item.sentAt))}</small>
        </span>
        <span className="sr-only">(se abre en una pestaña nueva)</span>
      </a>
    </li>
  );
}

/**
 * Non-modal panel with the photos, videos, documents and links shared in a
 * conversation. Same shell as ChatProfilePanel: it must be rendered inside the
 * positioned `.chat-conversation` section.
 *
 * Known limit: attachments are base64 in this browser's localStorage in this
 * stage, so the history only shows what was sent from this browser.
 */
export function ChatFilesPanel({
  open,
  title,
  shared,
  authorName,
  onClose,
}: {
  open: boolean;
  /** Conversation name, shown as the subtitle. */
  title: string;
  shared: SharedMedia;
  authorName: (id: string) => string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(open);
  const [tab, setTab] = useState<TabId>("media");
  const [viewer, setViewer] = useState<number | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    media: null,
    documents: null,
    links: null,
  });

  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) return;
    // After the exit, the next opening starts on Multimedia, viewer closed.
    const timer = window.setTimeout(() => {
      setMounted(false);
      setTab("media");
      setViewer(null);
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

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
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "media", label: "Multimedia", count: shared.media.length },
    { id: "documents", label: "Documentos", count: shared.documents.length },
    { id: "links", label: "Enlaces", count: shared.links.length },
  ];
  function onTabKeyDown(event: KeyboardEvent, position: number) {
    const move =
      event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowLeft"
          ? -1
          : event.key === "Home"
            ? -position
            : event.key === "End"
              ? tabs.length - 1 - position
              : 0;
    if (!move) return;
    event.preventDefault();
    const next = tabs[(position + move + tabs.length) % tabs.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  const state = open ? "open" : "closed";
  const current = tabs.find((entry) => entry.id === tab) ?? tabs[0];
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
        aria-label="Archivos compartidos"
      >
        <header className="chat-profile-bar">
          <button
            ref={closeButton}
            type="button"
            className="chat-profile-close"
            aria-label="Cerrar archivos compartidos"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <div className="chat-files-title">
            <h3>Archivos compartidos</h3>
            <p>{title}</p>
          </div>
        </header>
        <div
          className="chat-files-tabs"
          role="tablist"
          aria-label="Tipo de archivo"
        >
          {tabs.map((entry, position) => (
            <button
              key={entry.id}
              ref={(element) => {
                tabRefs.current[entry.id] = element;
              }}
              type="button"
              role="tab"
              id={`chat-files-tab-${entry.id}`}
              aria-selected={tab === entry.id}
              aria-controls="chat-files-tabpanel"
              tabIndex={tab === entry.id ? 0 : -1}
              onClick={() => setTab(entry.id)}
              onKeyDown={(event) => onTabKeyDown(event, position)}
            >
              {entry.label} <span className="num">({entry.count})</span>
            </button>
          ))}
        </div>
        <div
          className="chat-profile-scroll chat-files-scroll"
          role="tabpanel"
          id="chat-files-tabpanel"
          aria-labelledby={`chat-files-tab-${tab}`}
        >
          {current.count === 0 ? (
            <div className="chat-files-empty">
              <strong>{EMPTY[tab].title}</strong>
              <p>{EMPTY[tab].hint}</p>
            </div>
          ) : tab === "media" ? (
            <MediaGrid items={shared.media} onOpen={setViewer} />
          ) : tab === "documents" ? (
            <Months items={shared.documents}>
              {(item) => (
                <DocumentRow key={item.messageId + item.name} item={item} />
              )}
            </Months>
          ) : (
            <Months items={shared.links}>
              {(item) => (
                <LinkRow key={item.messageId + item.url} item={item} />
              )}
            </Months>
          )}
        </div>
      </aside>
      {viewer !== null && (
        <ChatMediaViewer
          items={shared.media}
          index={Math.min(viewer, shared.media.length - 1)}
          authorName={authorName}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  );
}

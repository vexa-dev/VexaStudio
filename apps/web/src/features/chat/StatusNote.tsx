/** Compact thought cloud with someone's status; hidden when the text is empty. */
export function StatusNote({
  text,
  size = "sm",
}: {
  text: string;
  size?: "sm" | "md";
}) {
  const value = text.trim();
  if (!value) return null;
  return (
    <p className={`chat-status-note is-${size}`} title={`Estado: ${value}`}>
      <span className="sr-only">Estado: </span>
      <span className="chat-status-note-text">
        {value}
      </span>
      <i className="chat-status-tail-a" aria-hidden="true" />
      <i className="chat-status-tail-b" aria-hidden="true" />
    </p>
  );
}

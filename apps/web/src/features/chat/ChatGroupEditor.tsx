import { chatCopy } from "./chat-copy";
import { useState } from "react";
import type { Profile } from "@vexa/domain/types";
import { Sheet } from "@/components/ui/Sheet";
import { Field, TextareaField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import type { ChatThread } from "@vexa/domain/chat";

export function ChatGroupEditor({
  user,
  members,
  group,
  onClose,
  onSave,
  onDelete,
}: {
  user: Profile;
  members: Profile[];
  group?: ChatThread;
  onClose: () => void;
  onSave: (
    name: string,
    description: string,
    memberIds: string[],
  ) => Promise<boolean>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [selected, setSelected] = useState([
    ...new Set([user.id, ...(group?.members ?? [])]),
  ]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (user.role !== "admin") return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={group ? "Administrar grupo" : "Crear grupo"}
      description="Solo los administradores gestionan los grupos y sus integrantes."
    >
      <div className="chat-group-form">
        <Field
          label="Nombre del grupo"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
        />
        <TextareaField
          label="Descripción"
          value={description}
          maxLength={240}
          onChange={(event) => setDescription(event.target.value)}
        />
        <h3>Integrantes</h3>
        <p className="chat-hint">
          Los colaboradores solo verán los grupos a los que los asignes.
        </p>
        <div className="chat-member-selection">
          {members.map((member) => (
            <label key={member.id}>
              <input
                type="checkbox"
                checked={selected.includes(member.id)}
                disabled={member.id === user.id}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(member.id)
                      ? current.filter((id) => id !== member.id)
                      : [...current, member.id],
                  )
                }
              />
              <Avatar name={member.name} src={member.avatarUrl} size="sm" />
              <span>
                {member.name}
                <small>
                  {member.role === "admin" ? "Administrador" : "Integrante"}
                </small>
              </span>
            </label>
          ))}
        </div>
        <div className="chat-modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!name.trim() || selected.length < 2 || busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (await onSave(name, description, selected)) onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {group ? "Guardar grupo" : "Crear grupo"}
          </Button>
        </div>
        {group && (
          <div className="chat-group-delete">
            {confirm ? (
              <>
                <p>{chatCopy.deleteGroup}</p>
                <Button variant="secondary" onClick={() => setConfirm(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onDelete();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Eliminar grupo
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirm(true)}>
                Eliminar grupo
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

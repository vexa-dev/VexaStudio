import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { formatDateTime } from "@vexa/domain/dates";
import type { AuthSession, MfaEnrollment } from "@vexa/domain/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  supportsAccountSecurity,
  useChangePassword,
  useDisableMfa,
  useEnrollMfa,
  useMfaFactors,
  useRevokeSession,
  useSessions,
  useSignOutOthers,
} from "../hooks/useAccountSettings";
import { describeDevice } from "../device";
import { passwordFormSchema, type PasswordFormValues } from "../schemas";
import { MfaSetupSheet } from "./MfaSetupSheet";

const SUPABASE_ONLY = "Disponible al conectar con Supabase.";
const EMPTY_PASSWORDS: PasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function SupabaseOnlyNotice() {
  return (
    <p className="profile-session-note" role="note">
      {SUPABASE_ONLY}
    </p>
  );
}

function PasswordCard({ enabled }: { enabled: boolean }) {
  const change = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isValid },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: EMPTY_PASSWORDS,
    mode: "onChange",
  });

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) =>
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => reset(EMPTY_PASSWORDS),
        onError: (error) => {
          if (/actual/i.test(error.message))
            setError("currentPassword", { type: "server", message: error.message });
        },
      },
    ),
  );

  return (
    <Card className="profile-panel">
      <div className="profile-section-heading">
        <span>02 / CUENTA</span>
        <h2>Seguridad</h2>
        <p>Gestiona el acceso a tu espacio de trabajo.</p>
      </div>
      <h3>Cambiar contraseña</h3>
      <p className="profile-help">
        Usa al menos 12 caracteres, con mayúsculas, minúsculas y números.
      </p>
      {enabled ? null : <SupabaseOnlyNotice />}
      <form onSubmit={onSubmit} noValidate>
        <div className="profile-fields">
          <div className="profile-full">
            <Field
              label="Contraseña actual"
              type="password"
              autoComplete="current-password"
              disabled={!enabled}
              error={errors.currentPassword?.message}
              {...register("currentPassword")}
            />
          </div>
          <Field
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            disabled={!enabled}
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />
          <Field
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            disabled={!enabled}
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
        </div>
        {enabled ? (
          <div className="profile-footer">
            <p>Se te pedirá la contraseña actual para confirmar el cambio.</p>
            <Button type="submit" disabled={!isValid || change.isPending}>
              {change.isPending ? "Actualizando…" : "Actualizar contraseña"}
            </Button>
          </div>
        ) : null}
      </form>
    </Card>
  );
}

function MfaCard({ enabled }: { enabled: boolean }) {
  const factors = useMfaFactors(enabled);
  const enroll = useEnrollMfa();
  const disable = useDisableMfa();
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const verified = factors.data?.find((factor) => factor.status === "verified");

  return (
    <Card className="profile-panel profile-security-card">
      <div className="profile-section-title">
        <ShieldCheck size={21} aria-hidden="true" />
        <div>
          <h3>Verificación en dos pasos</h3>
          <p className="profile-help">
            Al iniciar sesión, además de tu contraseña se pide un código de tu aplicación de
            autenticación.
          </p>
        </div>
        {enabled && factors.data ? (
          <Badge tone={verified ? "success" : "neutral"}>
            {verified ? "Activada" : "Desactivada"}
          </Badge>
        ) : null}
      </div>
      {!enabled ? (
        <SupabaseOnlyNotice />
      ) : factors.isError ? (
        <ErrorState
          title="No se pudo cargar la verificación"
          message={factors.error.message}
          onRetry={() => void factors.refetch()}
        />
      ) : !factors.data ? (
        <output className="flex flex-col gap-3" aria-label="Cargando verificación en dos pasos">
          <Skeleton className="h-12" />
        </output>
      ) : (
        <>
          <div className="profile-security-action">
            <div>
              <strong>Aplicación de autenticación</strong>
              <p>
                {verified
                  ? "Tu cuenta pide un código al iniciar sesión."
                  : "Google Authenticator, Microsoft Authenticator o similar."}
              </p>
            </div>
            {verified ? (
              <Button variant="secondary" onClick={() => setConfirmingDisable(true)}>
                Desactivar
              </Button>
            ) : (
              <Button
                disabled={enroll.isPending}
                onClick={() => enroll.mutate(undefined, { onSuccess: setEnrollment })}
              >
                {enroll.isPending ? "Preparando…" : "Activar"}
              </Button>
            )}
          </div>
          <p className="profile-session-note" role="note">
            No hay códigos de recuperación. Si pierdes tu teléfono, un administrador debe quitar
            la verificación de tu cuenta.
          </p>
        </>
      )}
      <MfaSetupSheet enrollment={enrollment} onClose={() => setEnrollment(null)} />
      <Sheet
        open={confirmingDisable}
        onClose={() => setConfirmingDisable(false)}
        title="Desactivar verificación en dos pasos"
        description="Tu cuenta volverá a entrar solo con la contraseña, y será menos segura."
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Para volver a activarla tendrás que escanear un código QR nuevo.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmingDisable(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={disable.isPending || !verified}
              onClick={() =>
                verified &&
                disable.mutate(verified.id, { onSuccess: () => setConfirmingDisable(false) })
              }
            >
              {disable.isPending ? "Desactivando…" : "Desactivar"}
            </Button>
          </div>
        </div>
      </Sheet>
    </Card>
  );
}

function SessionsCard({ enabled }: { enabled: boolean }) {
  const sessions = useSessions(enabled);
  const revoke = useRevokeSession();
  const signOutOthers = useSignOutOthers();
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [target, setTarget] = useState<AuthSession | null>(null);
  const others = (sessions.data ?? []).filter((session) => !session.isCurrent);
  return (
    <Card className="profile-panel profile-security-card">
      <div className="profile-section-heading">
        <h2>Dispositivos y sesiones</h2>
        <p>Controla dónde tienes abierta tu cuenta.</p>
      </div>
      {!enabled ? (
        <SupabaseOnlyNotice />
      ) : sessions.isError ? (
        <ErrorState
          title="No se pudieron cargar las sesiones"
          message={sessions.error.message}
          onRetry={() => void sessions.refetch()}
        />
      ) : !sessions.data ? (
        <output className="flex flex-col gap-3" aria-label="Cargando sesiones">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </output>
      ) : (
        <>
          {sessions.data.map((session) => (
            <div key={session.id} className="profile-security-action">
              <div>
                <strong>
                  {describeDevice(session.userAgent)}{" "}
                  {session.isCurrent ? <Badge tone="success">Este dispositivo</Badge> : null}
                </strong>
                <p>
                  Última actividad: <span className="num">{formatDateTime(session.lastActiveAt)}</span>
                </p>
              </div>
              {session.isCurrent ? null : (
                <Button
                  variant="secondary"
                  aria-label={`Cerrar la sesión de ${describeDevice(session.userAgent)}`}
                  onClick={() => setTarget(session)}
                >
                  Cerrar
                </Button>
              )}
            </div>
          ))}
          {others.length ? (
            <div className="profile-security-action">
              <p>Si dudas de algún acceso, cierra todas las demás sesiones.</p>
              <Button variant="secondary" onClick={() => setConfirmingAll(true)}>
                <LogOut size={16} aria-hidden="true" />
                Cerrar todas las demás
              </Button>
            </div>
          ) : null}
        </>
      )}
      <Sheet
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Cerrar esta sesión"
        description={
          target
            ? `${describeDevice(target.userAgent)}. Tendrás que volver a iniciar sesión allí.`
            : undefined
        }
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setTarget(null)}>
            Cancelar
          </Button>
          <Button
            disabled={revoke.isPending}
            onClick={() => target && revoke.mutate(target.id, { onSettled: () => setTarget(null) })}
          >
            {revoke.isPending ? "Cerrando…" : "Cerrar sesión"}
          </Button>
        </div>
      </Sheet>
      <Sheet
        open={confirmingAll}
        onClose={() => setConfirmingAll(false)}
        title="Cerrar todas las demás sesiones"
        description="Tendrás que volver a iniciar sesión en cada uno de esos dispositivos."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmingAll(false)}>
            Cancelar
          </Button>
          <Button
            disabled={signOutOthers.isPending}
            onClick={() => signOutOthers.mutate(undefined, { onSuccess: () => setConfirmingAll(false) })}
          >
            {signOutOthers.isPending ? "Cerrando…" : "Cerrar sesiones"}
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

/** Password, two-step verification and sessions. Real only with the Supabase data source. */
export function SecuritySection() {
  const enabled = supportsAccountSecurity();
  return (
    <>
      <PasswordCard enabled={enabled} />
      <MfaCard enabled={enabled} />
      <SessionsCard enabled={enabled} />
    </>
  );
}

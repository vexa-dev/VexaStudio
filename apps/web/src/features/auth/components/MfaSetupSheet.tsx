import { zodResolver } from "@hookform/resolvers/zod";
import { Copy } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { MfaEnrollment } from "@vexa/domain/types";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useVerifyMfaEnrollment } from "../hooks/useAccountSettings";
import {
  MFA_CODE_LENGTH,
  mfaCodeSchema,
  normalizeCodeInput,
  qrImageSrc,
  type MfaCodeValues,
} from "../schemas";

async function copySecret(secret: string) {
  try {
    await navigator.clipboard.writeText(secret);
    toast.success("Clave copiada");
  } catch {
    toast.error("No se pudo copiar. Selecciona la clave y cópiala a mano.");
  }
}

function SetupContent({
  enrollment,
  onDone,
}: {
  enrollment: MfaEnrollment;
  onDone: () => void;
}) {
  const verify = useVerifyMfaEnrollment();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isValid },
  } = useForm<MfaCodeValues>({
    resolver: zodResolver(mfaCodeSchema),
    defaultValues: { code: "" },
    mode: "onChange",
  });
  const qr = qrImageSrc(enrollment.qrCodeSvg);

  const onSubmit = handleSubmit((values) =>
    verify.mutate(
      { factorId: enrollment.factorId, code: values.code },
      {
        onSuccess: onDone,
        onError: (error) => setError("code", { type: "server", message: error.message }),
      },
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
        <li>Abre tu aplicación de autenticación y escanea el código QR.</li>
        <li>Escribe aquí el código de {MFA_CODE_LENGTH} dígitos que te muestra.</li>
      </ol>
      {qr ? (
        <img
          src={qr}
          alt="Código QR para añadir VEXA Studio a tu aplicación de autenticación"
          className="mx-auto size-48 rounded-lg bg-white p-2"
        />
      ) : null}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">¿No puedes escanear? Escribe esta clave</span>
        <div className="flex items-center gap-2">
          <code className="num min-h-11 flex-1 select-all break-all rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm">
            {enrollment.secret}
          </code>
          <Button
            variant="secondary"
            aria-label="Copiar clave"
            onClick={() => void copySecret(enrollment.secret)}
          >
            <Copy size={16} aria-hidden="true" />
            Copiar
          </Button>
        </div>
      </div>
      <Field
        label="Código de verificación"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={MFA_CODE_LENGTH}
        placeholder="000000"
        className="num tracking-[0.3em]"
        error={errors.code?.message}
        {...register("code", {
          onChange: (event) =>
            setValue("code", normalizeCodeInput(event.target.value), {
              shouldValidate: true,
              shouldDirty: true,
            }),
        })}
      />
      <p className="text-sm text-muted">
        VEXA no genera códigos de recuperación. Si pierdes tu teléfono, un administrador debe
        quitar la verificación de tu cuenta.
      </p>
      <Button type="submit" disabled={!isValid || verify.isPending}>
        {verify.isPending ? "Verificando…" : "Activar verificación"}
      </Button>
    </form>
  );
}

/** Enrollment sheet: QR, text secret and the confirmation code. Content mounts only when open. */
export function MfaSetupSheet({
  enrollment,
  onClose,
}: {
  enrollment: MfaEnrollment | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={enrollment !== null}
      onClose={onClose}
      title="Activar verificación en dos pasos"
      description="Usa Google Authenticator, Microsoft Authenticator o una app similar."
    >
      {enrollment ? <SetupContent enrollment={enrollment} onDone={onClose} /> : null}
    </Sheet>
  );
}

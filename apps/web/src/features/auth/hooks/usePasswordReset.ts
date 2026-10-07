import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { services } from "@/services";
import type { CredentialsAuthService } from "@/services/supabase/auth";

const SESSION_KEY = ["auth", "session"];
const UNAVAILABLE = "El restablecimiento de contraseña solo funciona con Supabase.";

/** Pide el enlace de recuperación. Responde igual para cualquier correo: no confirma si existe. */
export function useRequestPasswordReset() {
  return useMutation<void, Error, string>({
    mutationFn: async (email) => {
      if (!services.auth.requestPasswordReset) throw new Error(UNAVAILABLE);
      await services.auth.requestPasswordReset(email);
    },
  });
}

/** Fija la contraseña nueva y deja la sesión cerrada: la persona vuelve a entrar con la nueva. */
export function useCompletePasswordReset() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (newPassword) => {
      if (!services.auth.completePasswordReset) throw new Error(UNAVAILABLE);
      await services.auth.completePasswordReset(newPassword);
    },
    // El servicio cerró todas las sesiones; la caché de sesión no debe seguir mostrando a nadie.
    onSuccess: () => queryClient.setQueryData(SESSION_KEY, null),
  });
}

export type RecoveryState = "checking" | "ready" | "invalid";

// StrictMode monta dos veces: los tokens del enlace solo se canjean una vez por carga.
const inflight = new Map<string, Promise<"ready" | "invalid">>();

/** Canjea los tokens del enlace del correo y limpia la URL para no dejarlos a la vista. */
export function usePasswordRecovery(): RecoveryState {
  const [state, setState] = useState<RecoveryState>("checking");
  useEffect(() => {
    let active = true;
    const auth = services.auth as Partial<CredentialsAuthService>;
    const hash = window.location.hash;
    let attempt = inflight.get(hash);
    if (!attempt) {
      attempt = auth.beginPasswordRecovery
        ? auth.beginPasswordRecovery(hash).catch(() => "invalid" as const)
        : Promise.resolve("invalid" as const);
      inflight.set(hash, attempt);
    }
    void attempt.then((outcome) => {
      if (outcome === "ready")
        window.history.replaceState(null, "", window.location.pathname);
      if (active) setState(outcome);
    });
    return () => {
      active = false;
    };
  }, []);
  return state;
}

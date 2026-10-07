import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Id, NotificationPreferences, Profile, ProfileDetailsInput } from "@vexa/domain/types";
import { services } from "@/services";
import { isSupabaseSource } from "@/services/supabase/data-source";

const SESSION_KEY = ["auth", "session"];
const MFA_FACTORS_KEY = ["auth", "mfa-factors"];
const SESSIONS_KEY = ["auth", "sessions"];
const PREFERENCES_KEY = ["notifications", "preferences"];

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** Password, two-step and session controls only exist with the Supabase data source. */
export function supportsAccountSecurity(): boolean {
  return isSupabaseSource() && "signInWithPassword" in services.auth;
}

/** Saves name, username and bio, then refreshes the session user so header and chat follow. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation<Profile, Error, ProfileDetailsInput>({
    mutationFn: (input) => services.auth.updateProfile(input),
    onSuccess: (profile: Profile) => {
      queryClient.setQueryData(SESSION_KEY, profile);
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success("Datos guardados");
    },
    onError: (error: unknown) => toast.error(messageOf(error, "No se pudieron guardar los datos")),
  });
}

export function useChangePassword() {
  return useMutation<void, Error, { currentPassword: string; newPassword: string }>({
    mutationFn: (input) =>
      services.auth.updatePassword(input),
    onSuccess: () => toast.success("Contraseña actualizada"),
    onError: (error: unknown) =>
      toast.error(messageOf(error, "No se pudo actualizar la contraseña")),
  });
}

export function useMfaFactors(enabled: boolean) {
  return useQuery({
    queryKey: MFA_FACTORS_KEY,
    queryFn: () => services.auth.listMfaFactors(),
    enabled,
  });
}

/** Starts an enrollment. The result (QR and secret) lives only in the caller's state. */
export function useEnrollMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => services.auth.enrollMfa(),
    // `enroll` discards abandoned factors, so the listed ones may have changed.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: MFA_FACTORS_KEY }),
    onError: (error: unknown) =>
      toast.error(messageOf(error, "No se pudo iniciar la verificación en dos pasos")),
  });
}

export function useVerifyMfaEnrollment() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { factorId: Id; code: string }>({
    mutationFn: (input) =>
      services.auth.verifyMfaEnrollment(input.factorId, input.code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MFA_FACTORS_KEY });
      toast.success("Verificación en dos pasos activada");
    },
    // The sheet shows the same message inline, next to the code field.
  });
}

export function useDisableMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (factorId: Id) => services.auth.disableMfa(factorId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MFA_FACTORS_KEY });
      toast.success("Verificación en dos pasos desactivada");
    },
    onError: (error: unknown) =>
      toast.error(messageOf(error, "No se pudo desactivar la verificación")),
  });
}

/** Active sessions of the signed-in person (current one first). */
export function useSessions(enabled: boolean) {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: () => services.auth.listSessions(),
    enabled,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, Id>({
    mutationFn: (id) => services.auth.revokeSession(id),
    onSuccess: () => toast.success("Cerraste esa sesión"),
    onError: (error: unknown) => toast.error(messageOf(error, "No se pudo cerrar la sesión")),
    // The list may have changed on the server either way (already closed elsewhere).
    onSettled: () => void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

export function useSignOutOthers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => services.auth.signOutOthers(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      toast.success("Cerraste la sesión en tus otros dispositivos");
    },
    onError: (error: unknown) =>
      toast.error(messageOf(error, "No se pudo cerrar la sesión en los otros dispositivos")),
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: () => services.notifications.getPreferences(),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      services.notifications.updatePreferences(patch),
    onSuccess: (saved: NotificationPreferences) => {
      queryClient.setQueryData(PREFERENCES_KEY, saved);
      toast.success("Preferencias guardadas");
    },
    onError: (error: unknown) =>
      toast.error(messageOf(error, "No se pudieron guardar las preferencias")),
  });
}

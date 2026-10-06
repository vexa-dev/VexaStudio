import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import type { Profile } from "@vexa/domain/types";
import { Button } from "@/components/ui/Button";
import { Field, TextareaField } from "@/components/ui/Field";
import { useUpdateProfile } from "../hooks/useAccountSettings";
import {
  BIO_MAX_LENGTH,
  profileFormSchema,
  toProfileInput,
  type ProfileFormValues,
} from "../schemas";

const USERNAME_TAKEN = /en uso/i;

const valuesOf = (user: Profile): ProfileFormValues => ({
  name: user.name,
  username: user.username ?? "",
  bio: user.bio ?? "",
});

/** Name, username and bio of the signed-in person. The email is shown read-only. */
export function PersonalDataForm({ user }: { user: Profile }) {
  const save = useUpdateProfile();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isDirty, isValid },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: valuesOf(user),
    mode: "onChange",
  });
  const bioLength = useWatch({ control, name: "bio" }).length;

  const onSubmit = handleSubmit((values) =>
    save.mutate(toProfileInput(values), {
      onSuccess: (profile) => reset(valuesOf(profile)),
      onError: (error) => {
        if (USERNAME_TAKEN.test(error.message))
          setError("username", { type: "server", message: "Ese usuario ya está en uso" });
      },
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="profile-fields">
        <Field
          label="Nombre visible"
          maxLength={80}
          autoComplete="name"
          hint="El nombre que aparecerá en tareas y proyectos."
          error={errors.name?.message}
          {...register("name")}
        />
        <Field
          label="Nombre de usuario"
          placeholder="tu.usuario"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          hint="Un identificador único, en minúsculas: letras, números, punto o guion bajo."
          error={errors.username?.message}
          {...register("username")}
        />
        <div className="profile-full">
          <Field
            label="Correo electrónico"
            type="email"
            value={user.email ?? ""}
            placeholder="Asociado a tu cuenta"
            readOnly
            disabled
            hint="El correo de tu cuenta no se cambia desde aquí."
          />
        </div>
        <div className="profile-full">
          <TextareaField
            label="Sobre mí"
            placeholder="Tu especialidad, en qué trabajas o cómo puedes ayudar al equipo…"
            maxLength={BIO_MAX_LENGTH}
            hint={
              <>
                Una presentación breve.{" "}
                <span className="num">
                  {bioLength}/{BIO_MAX_LENGTH}
                </span>
              </>
            }
            error={errors.bio?.message}
            {...register("bio")}
          />
        </div>
      </div>
      <div className="profile-account-info">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>Tu rol, área y compromiso semanal los administra el equipo.</p>
      </div>
      <div className="profile-footer">
        <p>Los cambios se ven en el encabezado y en el chat al guardar.</p>
        <Button type="submit" disabled={!isDirty || !isValid || save.isPending}>
          {save.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

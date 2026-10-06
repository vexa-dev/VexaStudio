import { describe, expect, it } from "vitest";
import {
  notImplemented,
  pending,
  toServiceError,
  unwrap,
  unwrapMaybe,
} from "./errors";

describe("toServiceError", () => {
  it("traduce los mensajes de GoTrue del cambio de contraseña", () => {
    expect(
      toServiceError({ message: "Current password required when setting new password." }).message,
    ).toBe("Escribe tu contraseña actual para cambiarla.");
    expect(toServiceError({ message: "Incorrect current password" }).message).toBe(
      "La contraseña actual no es correcta.",
    );
    expect(toServiceError({ message: "Invalid current password." }).message).toBe(
      "La contraseña actual no es correcta.",
    );
  });
  it("restituye los acentos de los mensajes que la base escribe sin ellos", () => {
    expect(
      toServiceError({
        message: "Deten el temporizador antes de editar el registro",
      }).message,
    ).toBe("Detén el temporizador antes de editar el registro");
    expect(
      toServiceError({ message: "Explica que necesita aclaracion" }).message,
    ).toBe("Explica qué necesita aclaración");
    expect(
      toServiceError({
        message: "Solo el administrador edita la asignacion y el contenido",
      }).message,
    ).toBe("Solo el administrador edita la asignación y el contenido");
  });

  it("traduce las restricciones por su nombre", () => {
    const error = toServiceError({
      code: "23514",
      message:
        'new row for relation "tasks" violates check constraint "tasks_link_check"',
    });
    expect(error.message).toBe("Usa un enlace http o https");
    expect(
      toServiceError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "project_labels_name_uidx"',
      }).message,
    ).toBe("Ya existe una etiqueta con ese nombre");
  });

  it("traduce los mensajes de las imágenes de perfil", () => {
    expect(
      toServiceError({ message: "Operacion de imagen no valida" }).message,
    ).toBe("Operación de imagen no válida");
    expect(
      toServiceError({ message: "La imagen no existe en el almacenamiento" })
        .message,
    ).toBe("La imagen no existe en el almacenamiento");
    expect(
      toServiceError({
        code: "23514",
        message:
          'new row for relation "profiles" violates check constraint "profiles_avatar_path_owner_check"',
      }).message,
    ).toBe("La imagen debe estar en tu carpeta");
  });

  it("una política RLS rechazada es un error de permisos", () => {
    expect(
      toServiceError({
        code: "42501",
        message: 'new row violates row-level security policy for table "tasks"',
      }).message,
    ).toBe("Tu rol no permite esta acción");
  });

  it("una sesión vencida pide iniciar sesión", () => {
    expect(
      toServiceError({ code: "PGRST303", message: "JWT expired" }).message,
    ).toBe("Inicia sesión para continuar");
  });

  it("un fallo de red se explica", () => {
    expect(toServiceError(new TypeError("Failed to fetch")).message).toBe(
      "No se pudo conectar con el servidor. Revisa tu conexión.",
    );
  });

  it("deja pasar un mensaje desconocido y conserva la causa", () => {
    const cause = { code: "XX000", message: "algo raro" };
    const error = toServiceError(cause);
    expect(error.message).toBe("algo raro");
    expect(error.cause).toBe(cause);
  });
});

describe("unwrap", () => {
  it("devuelve los datos o lanza el error traducido", async () => {
    expect(unwrap({ data: 3, error: null })).toBe(3);
    expect(() =>
      unwrap({ data: null, error: { message: "El proyecto no existe" } }),
    ).toThrow("El proyecto no existe");
    expect(() => unwrap({ data: null, error: null })).toThrow(
      "El servidor no devolvió datos",
    );
    expect(unwrapMaybe({ data: null, error: null })).toBeNull();
  });
});

describe("servicios pendientes", () => {
  it("fallan con un mensaje claro, igual que el mock", async () => {
    await expect(pending("SprintService.close")()).rejects.toThrow(
      "SprintService.close aún no está implementado",
    );
    await expect(
      notImplemented<{ list(): Promise<void> }>("CommentService").list(),
    ).rejects.toThrow("CommentService.list aún no está implementado");
    const service = notImplemented<object>("X");
    expect((service as { then?: unknown }).then).toBeUndefined();
  });
});

describe("canonical chat errors", () => {
  it("restores accents before mapping permission error codes", () => {
    expect(
      toServiceError({
        code: "42501",
        message: "No tienes acceso a esta conversacion.",
      }).message,
    ).toBe("No tienes acceso a esta conversación.");
    expect(
      toServiceError({
        message: "El tamano del archivo no coincide con el subido.",
      }).message,
    ).toBe("El tamaño del archivo no coincide con el subido.");
  });
});

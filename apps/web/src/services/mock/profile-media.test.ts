import { beforeEach, describe, expect, it } from "vitest";
import { resetMock, setSessionUserId } from "./db";
import { createMockServices } from "./index";
import {
  MAX_PROFILE_IMAGE_LENGTH,
  resetProfileMedia,
  validateProfileImage,
} from "./profile-media";

const png = "data:image/png;base64,iVBORw0KGgo=";
const jpeg = "data:image/jpeg;base64,/9j/4AAQ";
const services = createMockServices();

beforeEach(() => {
  resetMock();
  resetProfileMedia();
  setSessionUserId("u-rober");
});

describe("foto y banner del perfil", () => {
  it("guarda foto y banner del usuario con sesión", async () => {
    const profile = await services.auth.updateProfileMedia({
      avatarUrl: png,
      bannerUrl: jpeg,
    });
    expect(profile).toMatchObject({
      id: "u-rober",
      avatarUrl: png,
      bannerUrl: jpeg,
    });
  });

  it("otro usuario los lee con members.list y members.get", async () => {
    await services.auth.updateProfileMedia({ avatarUrl: png, bannerUrl: jpeg });
    setSessionUserId("u-jhony");
    const listed = (await services.members.list()).find(
      (p) => p.id === "u-rober",
    );
    expect(listed).toMatchObject({ avatarUrl: png, bannerUrl: jpeg });
    expect(await services.members.get("u-rober")).toMatchObject({
      avatarUrl: png,
    });
    const other = await services.members.get("u-jhony");
    expect(other?.avatarUrl ?? null).toBeNull();
  });

  it("null quita el valor", async () => {
    await services.auth.updateProfileMedia({ avatarUrl: png, bannerUrl: jpeg });
    const profile = await services.auth.updateProfileMedia({ avatarUrl: null });
    expect(profile.avatarUrl ?? null).toBeNull();
    expect(profile.bannerUrl).toBe(jpeg);
  });

  it("undefined deja intacto el otro campo", async () => {
    await services.auth.updateProfileMedia({ avatarUrl: png });
    const profile = await services.auth.updateProfileMedia({ bannerUrl: jpeg });
    expect(profile).toMatchObject({ avatarUrl: png, bannerUrl: jpeg });
  });

  it("rechaza un prefijo que no es imagen", async () => {
    await expect(
      services.auth.updateProfileMedia({ avatarUrl: "https://x.test/a.png" }),
    ).rejects.toThrow("imagen");
    await expect(
      services.auth.updateProfileMedia({
        bannerUrl: "data:text/html;base64,AA",
      }),
    ).rejects.toThrow("imagen");
    expect(() => validateProfileImage("data:image/gif;base64,AA")).toThrow();
  });

  it("rechaza imágenes demasiado pesadas", async () => {
    const big = `data:image/png;base64,${"A".repeat(MAX_PROFILE_IMAGE_LENGTH)}`;
    await expect(
      services.auth.updateProfileMedia({ avatarUrl: big }),
    ).rejects.toThrow("pesa");
  });

  it("exige sesión", async () => {
    setSessionUserId(null);
    await expect(
      services.auth.updateProfileMedia({ avatarUrl: png }),
    ).rejects.toThrow("Inicia sesión");
  });

  it("sobrevive a getSession y signIn", async () => {
    await services.auth.updateProfileMedia({ avatarUrl: png });
    expect(await services.auth.getSession()).toMatchObject({ avatarUrl: png });
    expect(await services.auth.signIn("u-rober")).toMatchObject({
      avatarUrl: png,
    });
    const login = (await services.auth.listLoginProfiles()).find(
      (p) => p.id === "u-rober",
    );
    expect(login?.avatarUrl).toBe(png);
  });
});

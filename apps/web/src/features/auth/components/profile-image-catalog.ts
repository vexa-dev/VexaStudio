/** Añadir aquí las imágenes del estudio, guardadas en public/profile/. */
export const profileImageCatalog = {
  photo: [
    { name: "Robot VEXA", src: "/mascot/vexa-robot.png" },
    { name: "Emblema VEXA", src: "/pwa-icon-512.png" },
  ],
  banner: [
    { name: "Órbita", src: "/profile/banner-orbit.svg" },
    { name: "Estudio", src: "/profile/banner-studio.svg" },
  ],
};
export type ProfileImageKind = keyof typeof profileImageCatalog;
export interface ProfileImageSelection {
  original: string;
  preview: string;
  zoom: number;
  x: number;
  y: number;
}

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: { globPatterns: ["**/*.{js,css,html,svg,woff2}"] },
      includeAssets: ["vexa-mark.svg"],
      manifest: {
        name: "VEXA Studio",
        short_name: "VEXA",
        description: "Plataforma interna de trabajo de VEXA",
        theme_color: "#0c1017",
        background_color: "#0c1017",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/vexa-mark.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});

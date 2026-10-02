import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["vexa-logo-light.svg", "vexa-logo-dark.svg", "apple-touch-icon.png"],
      workbox: {
        // Se precachean solo las fuentes latinas (cubren el español); el resto se pide bajo demanda.
        globPatterns: [
          "**/*.{js,css,html,svg,png,ico,webmanifest}",
          "**/*-latin-*.woff2",
        ],
        // SPA: cualquier ruta sin archivo se sirve desde el index.html precacheado.
        navigateFallback: "/index.html",
      },
      manifest: {
        name: "VEXA Studio",
        short_name: "VEXA",
        description: "Plataforma interna de trabajo de VEXA",
        lang: "es",
        theme_color: "#0c1017",
        background_color: "#0c1017",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          { src: "/vexa-logo-light.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
    }),
  ],
});

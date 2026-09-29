import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vexa-mark.svg'],
      manifest: {
        name: 'VEXA Studio',
        short_name: 'VEXA',
        description: 'Plataforma interna de trabajo de VEXA',
        theme_color: '#20775d',
        background_color: '#f7f8f6',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/vexa-mark.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})

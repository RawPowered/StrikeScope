import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/guide/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-guide', expiration: { maxEntries: 1, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /\/examples\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'guide-images', expiration: { maxEntries: 50, maxAgeSeconds: 604800 } },
          },
        ],
      },
      manifest: {
        name: 'StrikeScope — Photo Checklist',
        short_name: 'Photo Checklist',
        description: 'Site photo walkthrough for solar installers',
        theme_color: '#F57C00',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [{ src: '/icon.svg', sizes: '192x192', type: 'image/svg+xml' }],
      },
    }),
  ],
  server: { port: 5174 },
})

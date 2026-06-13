import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'StrikeScope — Field',
        short_name: 'Field',
        description: 'Clock-in, jobs, and geo-gated field capture',
        theme_color: '#F57C00',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [{ src: '/icon.svg', sizes: '192x192', type: 'image/svg+xml' }],
      },
    }),
  ],
  server: { port: 5176, proxy: { '/api': 'http://localhost:3001' } },
})

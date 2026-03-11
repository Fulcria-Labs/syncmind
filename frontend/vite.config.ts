import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false, // Use public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB for WASM files
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/localhost:6061\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 }
            }
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    exclude: ['@powersync/web']
  },
  worker: {
    format: 'es'
  }
})

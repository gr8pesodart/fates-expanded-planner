import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative base keeps the build working on GitHub Pages project sites,
  // custom domains and local static hosting alike.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Fates Expanded Planner',
        short_name: 'Fates Expanded',
        description:
          'Army planner for modded Fire Emblem Fates — supports, classes, skills, class routes and pair-up.',
        theme_color: '#f5f0e6',
        background_color: '#f5f0e6',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Game assets stay out of the precache: they are lazy-loaded and
        // cached on first use so the app shell stays small.
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        runtimeCaching: [
          {
            // URLs carry ?v=<manifest generatedAt>, so regenerated art is fetched fresh; the cache
            // was renamed when the sprite files changed layout under the same names.
            urlPattern: /assets\/.*\.webp(\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'game-assets-v2',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
})

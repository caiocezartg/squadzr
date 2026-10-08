import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { FontaineTransform } from 'fontaine'
import path from 'path'
import { fontPreload } from './plugins/font-preload'

export default defineConfig({
  plugins: [
    // Route components are split into per-route chunks automatically; the
    // bundle report reads the production manifest to measure initial loads.
    tanstackRouter({ autoCodeSplitting: true }),
    react(),
    // Self-hosted fonts (CCC-43): generates the metric-matched `@font-face`
    // fallbacks (`"Exo 2 fallback"`, `"Plus Jakarta Sans fallback"`) next to
    // the real fontsource faces. Arial is the system fallback the metrics are
    // adjusted against. `font-display: swap` stays in the fontsource CSS.
    FontaineTransform.vite({ fallbacks: ['Arial'] }),
    // Preloads the hero title and body base faces with their hashed URLs.
    fontPreload(),
  ],
  build: {
    manifest: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: ['.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})

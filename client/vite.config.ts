import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The CSP <meta> in index.html is for production builds; the dev server injects an inline
// React Refresh preamble that a strict script-src would block, so drop the tag under `vite serve`.
const stripCspInDev = (): Plugin => ({
  name: 'strip-csp-in-dev',
  apply: 'serve',
  transformIndexHtml: (html) =>
    html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/i, ''),
})

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      // Excalidraw's package.json exports map has a './*' wildcard that
      // returns only TypeScript types, which makes Rollup unable to resolve
      // CSS subpaths. Bypass the exports map by aliasing directly to the
      // built CSS file in node_modules.
      '@excalidraw/excalidraw/index.css': path.resolve(
        __dirname,
        'node_modules/@excalidraw/excalidraw/dist/prod/index.css',
      ),
    },
  },
  plugins: [
    stripCspInDev(),
    react(),
    ViteImageOptimizer({
      png: {
        quality: 80,
      },
      jpeg: {
        quality: 80,
      },
      jpg: {
        quality: 80,
      },
      webp: {
        quality: 80,
      },
      avif: {
        quality: 65,
      },
      svg: {
        multipass: true,
      },
    }),
  ],
})

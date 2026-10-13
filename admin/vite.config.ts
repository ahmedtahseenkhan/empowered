import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The CSP <meta> in index.html is for production builds. In dev, Vite injects an inline
// React-refresh preamble and an HMR websocket that a strict policy would block, so drop it there.
const stripCspInDev = (): Plugin => ({
  name: 'strip-csp-in-dev',
  apply: 'serve',
  transformIndexHtml: (html) =>
    html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>\s*/i, ''),
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), stripCspInDev()],
})

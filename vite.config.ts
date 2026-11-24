import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Single-page app: /, /booth/:slug and /qr are resolved client-side (see src/lib/router.ts).
// Vite's dev server and vercel.json both fall back to index.html for unknown paths.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    assetsInlineLimit: 4096,
  },
})

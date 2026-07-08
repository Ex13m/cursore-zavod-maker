import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// The portal imports cursorfx straight from source (instant HMR on lib changes).
// In dev, /api and /data proxy to the local factory devserver; in production
// /data ships statically (copied at build) and /api goes to Netlify Functions.
export default defineConfig({
  resolve: {
    alias: {
      cursorfx: resolve(__dirname, '../packages/cursorfx/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/data': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})

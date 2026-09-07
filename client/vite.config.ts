import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * A build's own identity — baked into the bundle it ships with, and dropped
 * alongside it as a small static file the running page can still fetch after
 * a newer build has replaced it on the server. The two staying equal is what
 * "this tab is running the build currently live" means; see
 * src/lib/versionCheck.ts for the other half.
 */
const BUILD_VERSION = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) || String(Date.now())

const publicDir = fileURLToPath(new URL('./public', import.meta.url))
if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true })
writeFileSync(path.join(publicDir, 'version.json'), JSON.stringify({ version: BUILD_VERSION }))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },
})

import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * A build's own identity — baked into the bundle it ships with, and dropped
 * alongside it as a small static file the running page can still fetch after
 * a newer build has replaced it on the server. The two staying equal is what
 * "this tab is running the build currently live" means; see
 * src/lib/versionCheck.ts for the other half.
 */
const BUILD_VERSION = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) || String(Date.now())

/**
 * Puts version.json where the running app can fetch it, without writing
 * into the source tree to get it there. A build environment is not
 * guaranteed to let a config file write back into the checkout it was
 * loaded from — emitting into the bundle is what Vite's own asset pipeline
 * exists for, and a dev-server route covers the one case that pipeline
 * doesn't run at all.
 */
function versionFile(): Plugin {
  const body = JSON.stringify({ version: BUILD_VERSION })
  return {
    name: 'version-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: body })
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(body)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), versionFile()],
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

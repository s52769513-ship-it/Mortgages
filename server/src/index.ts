import 'dotenv/config'
import { assertEnv } from './lib/env.js'

// Before anything else touches the database or signs a token.
assertEnv()

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { clientsRouter } from './routes/clients.js'
import { filesRouter } from './routes/files.js'
import { commentsRouter } from './routes/comments.js'
import { activityRouter } from './routes/activity.js'
import { dashboardRouter } from './routes/dashboard.js'
import { employeesRouter } from './routes/employees.js'
import { tasksRouter } from './routes/tasks.js'
import { documentsRouter } from './routes/documents.js'
import { bankAppsRouter } from './routes/bankApplications.js'
import { banksRouter } from './routes/banks.js'
import { notificationsRouter } from './routes/notifications.js'
import { communicationsRouter } from './routes/communications.js'
import { professionalsRouter } from './routes/professionals.js'
import { expensesRouter } from './routes/expenses.js'
import { searchRouter } from './routes/search.js'
import { bootstrapFirstAdmin } from './lib/bootstrap.js'
import { prisma } from './lib/prisma.js'

const app = express()

// Behind Railway's edge the client address arrives in X-Forwarded-For; without
// this every login attempt looks like it comes from the proxy, and the login
// throttle would lock the whole office out together.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

// Headers that cost nothing and close common browser-side holes. Microphone
// access is kept for this origin because the chat records voice notes.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()')
  next()
})

// In development the client runs on its own port and needs CORS. In production
// it is served from this same origin, so there is no cross-origin request to
// allow.
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
}
app.use(express.json({ limit: '1mb' }))

// A service whose database link has died is not healthy, whatever the
// process says; the platform restarts it only if this tells the truth.
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, db: true })
  } catch {
    res.status(503).json({ ok: false, db: false })
  }
})

app.use('/api/auth', authRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/files', filesRouter)
app.use('/api/comments', commentsRouter)
app.use('/api/activity', activityRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/employees', employeesRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/bank-applications', bankAppsRouter)
app.use('/api/banks', banksRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/communications', communicationsRouter)
app.use('/api/professionals', professionalsRouter)
app.use('/api/expenses', expensesRouter)
app.use('/api/search', searchRouter)

app.use('/api', (_req, res) => res.status(404).json({ error: 'הנתיב לא נמצא' }))

// Serve the built client, when there is one. Anything that is not an API route
// falls through to index.html so client-side routing keeps working on reload.
const clientDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../client/dist',
)

if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))
} else {
  app.use((_req, res) => res.status(404).json({ error: 'הנתיב לא נמצא' }))
}

const port = Number(process.env.PORT) || 4000

// Start accepting requests first. Creating the first administrator needs the
// database, and a database that is a second late must not stop the service
// from coming up — the platform would record that as a crashed deploy.
const server = app.listen(port, () => console.log(`API listening on port ${port}`))

bootstrapFirstAdmin().catch((error) => {
  console.error('Could not check for a first administrator:', error)
})

// A rejected promise nobody caught is a bug worth seeing in the log, but it is
// not a reason to drop every open request and restart the office's system.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason)
})

// Whatever finally kills this process should say so in the log. Without this a
// crash is a blank line followed by a restart, and the platform's "deployment
// crashed" mail is the only evidence that anything happened.
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception — shutting down:', error)
  process.exit(1)
})

process.on('exit', (code) => {
  if (code !== 0) console.error(`Process exiting with code ${code}`)
})

/**
 * Railway sends SIGTERM before replacing the container. Stop taking new
 * requests, let the ones in flight finish, and release the database.
 *
 * A keep-alive connection can hold server.close() open indefinitely, and a
 * shutdown that never finishes gets killed outright — which the platform then
 * reports as a crash. So the wait is capped.
 */
const SHUTDOWN_GRACE_MS = 10_000

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`)

    const done = () => prisma.$disconnect().finally(() => process.exit(0))
    const forced = setTimeout(() => {
      console.warn('Shutdown took too long; closing anyway')
      done()
    }, SHUTDOWN_GRACE_MS)
    forced.unref()

    server.close(() => {
      clearTimeout(forced)
      done()
    })
    server.closeIdleConnections()
  })
}

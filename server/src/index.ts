import 'dotenv/config'
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
import { bootstrapFirstAdmin } from './lib/bootstrap.js'

const app = express()

// In development the client runs on its own port and needs CORS. In production
// it is served from this same origin, so there is no cross-origin request to
// allow.
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
}
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

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

await bootstrapFirstAdmin()

app.listen(port, () => console.log(`API listening on http://localhost:${port}`))

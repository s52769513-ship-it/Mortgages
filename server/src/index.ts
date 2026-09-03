import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { clientsRouter } from './routes/clients.js'
import { filesRouter } from './routes/files.js'
import { commentsRouter } from './routes/comments.js'
import { activityRouter } from './routes/activity.js'
import { dashboardRouter } from './routes/dashboard.js'
import { employeesRouter } from './routes/employees.js'

const app = express()

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/files', filesRouter)
app.use('/api/comments', commentsRouter)
app.use('/api/activity', activityRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/employees', employeesRouter)

app.use((_req, res) => res.status(404).json({ error: 'הנתיב לא נמצא' }))

const port = Number(process.env.PORT) || 4000
app.listen(port, () => console.log(`API listening on http://localhost:${port}`))

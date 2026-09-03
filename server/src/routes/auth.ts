import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import {
  clearedSessionCookie,
  requireAuth,
  sessionCookie,
  signToken,
} from '../middleware/auth.js'

export const authRouter = Router()

/**
 * Guessing a password should get expensive quickly. Ten failures for one
 * address from one client, then a fifteen-minute wait. In memory, per
 * process — enough for one office; a cluster would want this in the database.
 */
const MAX_FAILURES = 10
const WINDOW_MS = 15 * 60 * 1000
const failures = new Map<string, { count: number; resetAt: number }>()

function throttleKey(ip: string, email: string) {
  return `${ip}|${email}`
}

function assertNotThrottled(key: string) {
  const entry = failures.get(key)
  if (!entry) return
  if (Date.now() > entry.resetAt) {
    failures.delete(key)
    return
  }
  if (entry.count >= MAX_FAILURES) {
    const minutes = Math.ceil((entry.resetAt - Date.now()) / 60_000)
    throw new HttpError(429, `יותר מדי ניסיונות. נסה שוב בעוד ${minutes} דקות.`)
  }
}

function recordFailure(key: string) {
  const entry = failures.get(key)
  if (entry && Date.now() <= entry.resetAt) entry.count += 1
  else failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS })

  // Keep the map from growing without bound between restarts.
  if (failures.size > 10_000) {
    for (const [k, v] of failures) if (Date.now() > v.resetAt) failures.delete(k)
  }
}

const loginSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה').transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, 'נדרשת סיסמה'),
})

authRouter.post(
  '/login',
  handler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body)
    const key = throttleKey(req.ip ?? 'unknown', email)
    assertNotThrottled(key)

    const employee = await prisma.employee.findUnique({ where: { email } })

    if (!employee || !employee.active || !(await bcrypt.compare(password, employee.password))) {
      recordFailure(key)
      throw new HttpError(401, 'אימייל או סיסמה שגויים')
    }

    failures.delete(key)

    const user = {
      id: employee.id,
      email: employee.email,
      role: employee.role,
      name: employee.name,
    }
    const token = signToken(user)

    res.setHeader('Set-Cookie', sessionCookie(token))
    res.json({ token, user })
  }),
)

authRouter.post(
  '/logout',
  handler(async (_req, res) => {
    res.setHeader('Set-Cookie', clearedSessionCookie())
    res.status(204).end()
  }),
)

authRouter.get(
  '/me',
  requireAuth,
  handler(async (req, res) => {
    res.json({ user: req.user })
  }),
)

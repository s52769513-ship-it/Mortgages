import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth, signToken } from '../middleware/auth.js'

export const authRouter = Router()

const loginSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(1, 'נדרשת סיסמה'),
})

authRouter.post(
  '/login',
  handler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body)
    const employee = await prisma.employee.findUnique({ where: { email } })

    if (!employee || !employee.active || !(await bcrypt.compare(password, employee.password))) {
      throw new HttpError(401, 'אימייל או סיסמה שגויים')
    }

    const user = {
      id: employee.id,
      email: employee.email,
      role: employee.role,
      name: employee.name,
    }
    res.json({ token: signToken(user), user })
  }),
)

authRouter.get(
  '/me',
  requireAuth,
  handler(async (req, res) => {
    res.json({ user: req.user })
  }),
)

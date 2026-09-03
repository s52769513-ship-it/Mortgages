import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const employeesRouter = Router()
employeesRouter.use(requireAuth)

const SAFE_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  team: true,
  active: true,
  createdAt: true,
} as const

// Every screen needs the assignee picker, so any signed-in user may list staff.
employeesRouter.get(
  '/',
  handler(async (_req, res) => {
    const employees = await prisma.employee.findMany({
      where: { active: true },
      select: SAFE_FIELDS,
      orderBy: { name: 'asc' },
    })
    res.json(employees)
  }),
)

const createSchema = z.object({
  name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים'),
  email: z
    .string()
    .email('כתובת אימייל לא תקינה')
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, 'סיסמה חייבת להכיל לפחות 8 תווים'),
  role: z.nativeEnum(Role).optional(),
  phone: z.string().nullish(),
  team: z.string().nullish(),
})

employeesRouter.post(
  '/',
  requireRole('ADMIN'),
  handler(async (req, res) => {
    const { password, ...rest } = createSchema.parse(req.body)

    if (await prisma.employee.findUnique({ where: { email: rest.email } })) {
      throw new HttpError(409, 'קיים כבר עובד עם כתובת אימייל זו')
    }

    const employee = await prisma.employee.create({
      data: { ...rest, password: await bcrypt.hash(password, 10) },
      select: SAFE_FIELDS,
    })
    res.status(201).json(employee)
  }),
)

employeesRouter.patch(
  '/:id',
  requireRole('ADMIN'),
  handler(async (req, res) => {
    const data = createSchema.partial().parse(req.body)
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(data.password ? { password: await bcrypt.hash(data.password, 10) } : {}),
      },
      select: SAFE_FIELDS,
    })
    res.json(employee)
  }),
)

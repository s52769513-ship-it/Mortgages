import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { logActivity } from '../lib/activity.js'

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

const employeeSchema = z.object({
  name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים'),
  email: z
    .string()
    .email('כתובת אימייל לא תקינה')
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, 'סיסמה חייבת להכיל לפחות 8 תווים'),
  role: z.nativeEnum(Role).optional(),
  phone: z.string().nullish(),
  team: z.string().nullish(),
  active: z.boolean().optional(),
})

/**
 * Any signed-in user may list active staff, because every assignee picker in
 * the app needs it. Only an administrator sees deactivated accounts or makes
 * changes.
 */
employeesRouter.get(
  '/',
  handler(async (req, res) => {
    const showAll = req.query.includeInactive === '1' && req.user!.role === 'ADMIN'

    const employees = await prisma.employee.findMany({
      where: showAll ? undefined : { active: true },
      select: {
        ...SAFE_FIELDS,
        ...(showAll
          ? { _count: { select: { filesOwned: true, tasksOwned: true, clientsOwned: true } } }
          : {}),
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    })
    res.json(employees)
  }),
)

employeesRouter.post(
  '/',
  requireRole('ADMIN'),
  handler(async (req, res) => {
    const { password, ...rest } = employeeSchema.parse(req.body)

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
    const data = employeeSchema.partial().parse(req.body)

    const before = await prisma.employee.findUnique({ where: { id: req.params.id } })
    if (!before) throw new HttpError(404, 'העובד לא נמצא')

    if (data.email && data.email !== before.email) {
      if (await prisma.employee.findUnique({ where: { email: data.email } })) {
        throw new HttpError(409, 'קיים כבר עובד עם כתובת אימייל זו')
      }
    }

    // Losing the last administrator would lock everyone out of user management.
    const losingAdmin =
      before.role === 'ADMIN' && (data.role !== undefined ? data.role !== 'ADMIN' : data.active === false)

    if (losingAdmin) {
      const admins = await prisma.employee.count({ where: { role: 'ADMIN', active: true } })
      if (admins <= 1) {
        throw new HttpError(400, 'לא ניתן להשאיר את המערכת בלי מנהל מערכת פעיל')
      }
    }

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(data.password ? { password: await bcrypt.hash(data.password, 10) } : {}),
      },
      select: SAFE_FIELDS,
    })

    if (data.active !== undefined && data.active !== before.active) {
      await logActivity({
        entityType: 'EMPLOYEE',
        entityId: employee.id,
        actorId: req.user!.id,
        action: data.active ? `הפעלת משתמש — ${employee.name}` : `השבתת משתמש — ${employee.name}`,
      })
    }

    res.json(employee)
  }),
)

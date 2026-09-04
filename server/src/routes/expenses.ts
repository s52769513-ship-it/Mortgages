import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { diff, logActivity } from '../lib/activity.js'

export const expensesRouter = Router()
expensesRouter.use(requireAuth)

const expenseSchema = z.object({
  fileId: z.string().min(1, 'נדרש תיק'),
  amount: z.coerce.number().positive('הסכום חייב להיות גדול מאפס'),
  details: z.string().min(2, 'נדרש פירוט'),
  spentAt: z.coerce.date().optional(),
})

expensesRouter.get(
  '/',
  handler(async (req, res) => {
    const { fileId } = req.query as Record<string, string>

    const where = fileId ? { fileId } : {}
    const [items, sum] = await Promise.all([
      prisma.officeExpense.findMany({
        where,
        include: {
          file: { select: { id: true, fileNumber: true, client: { select: { fullName: true } } } },
        },
        orderBy: { spentAt: 'desc' },
        take: 200,
      }),
      prisma.officeExpense.aggregate({ where, _sum: { amount: true } }),
    ])

    res.json({ items, total: sum._sum.amount ?? 0 })
  }),
)

expensesRouter.post(
  '/',
  handler(async (req, res) => {
    const data = expenseSchema.parse(req.body)

    if (!(await prisma.mortgageFile.findUnique({ where: { id: data.fileId } }))) {
      throw new HttpError(400, 'התיק שנבחר לא קיים')
    }

    const expense = await prisma.officeExpense.create({ data })
    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: data.fileId,
      actorId: req.user!.id,
      action: `הוצאה נרשמה — ${expense.details}`,
    })
    res.status(201).json(expense)
  }),
)

expensesRouter.patch(
  '/:id',
  handler(async (req, res) => {
    // Which file an expense belongs to is not something correcting it changes.
    const data = expenseSchema.omit({ fileId: true }).partial().parse(req.body)

    const before = await prisma.officeExpense.findUnique({ where: { id: req.params.id } })
    if (!before) throw new HttpError(404, 'ההוצאה לא נמצאה')

    const expense = await prisma.officeExpense.update({ where: { id: req.params.id }, data })

    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: expense.fileId,
      actorId: req.user!.id,
      action: `עדכון הוצאה — ${expense.details}`,
      changes: diff(before, data),
    })
    res.json(expense)
  }),
)

expensesRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const expense = await prisma.officeExpense.findUnique({ where: { id: req.params.id } })
    if (!expense) throw new HttpError(404, 'ההוצאה לא נמצאה')

    await prisma.officeExpense.delete({ where: { id: req.params.id } })
    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: expense.fileId,
      actorId: req.user!.id,
      action: `מחיקת הוצאה — ${expense.details}`,
    })
    res.status(204).end()
  }),
)

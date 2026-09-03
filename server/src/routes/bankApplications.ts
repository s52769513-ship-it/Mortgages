import { Router } from 'express'
import { z } from 'zod'
import { BankApplicationStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { diff, logActivity } from '../lib/activity.js'
import { withSeq } from '../lib/sequence.js'
import { parsePaging, parseSort } from '../lib/listing.js'

const APPLICATION_SORTS = ['status', 'requestedAmount', 'submittedAt', 'updatedAt', 'seq'] as const

export const bankAppsRouter = Router()
bankAppsRouter.use(requireAuth)

const appSchema = z.object({
  fileId: z.string().min(1, 'נדרש תיק'),
  bankName: z.string().min(2, 'נדרש שם בנק'),
  branchName: z.string().nullish(),
  bankerName: z.string().nullish(),
  bankerPhone: z.string().nullish(),
  bankerEmail: z.string().nullish(),
  managerName: z.string().nullish(),
  submittedAt: z.coerce.date().nullish(),
  submissionMethod: z.string().nullish(),
  requestedAmount: z.coerce.number().nonnegative().nullish(),
  ltvPercent: z.coerce.number().min(0).max(100).nullish(),
  mixNotes: z.string().nullish(),
  offeredRates: z.string().nullish(),
  status: z.nativeEnum(BankApplicationStatus).optional(),
  missingItems: z.string().nullish(),
  creditCheck: z.string().nullish(),
  approvalInPrinciple: z.boolean().optional(),
  approvalDate: z.coerce.date().nullish(),
  approvalValidUntil: z.coerce.date().nullish(),
  fileOpened: z.boolean().optional(),
  collateralReceived: z.boolean().optional(),
  sentToReview: z.boolean().optional(),
  sentToExecution: z.boolean().optional(),
  executedAt: z.coerce.date().nullish(),
  rejectionReason: z.string().nullish(),
  isChosen: z.boolean().optional(),
})

const LIST_INCLUDE = {
  bank: true,
  branch: true,
  banker: true,
  file: {
    select: { id: true, fileNumber: true, client: { select: { fullName: true } } },
  },
} as const

/**
 * Bank, branch and banker are typed as free text and created on first use, so
 * the office's list of contacts builds itself instead of needing setup.
 */
async function resolveContacts(input: {
  bankName: string
  branchName?: string | null
  bankerName?: string | null
  bankerPhone?: string | null
  bankerEmail?: string | null
}) {
  const bank = await prisma.bank.upsert({
    where: { name: input.bankName.trim() },
    update: {},
    create: { name: input.bankName.trim() },
  })

  if (!input.branchName?.trim()) return { bankId: bank.id, branchId: null, bankerId: null }

  const branch = await prisma.bankBranch.upsert({
    where: { bankId_name: { bankId: bank.id, name: input.branchName.trim() } },
    update: {},
    create: { bankId: bank.id, name: input.branchName.trim() },
  })

  if (!input.bankerName?.trim()) return { bankId: bank.id, branchId: branch.id, bankerId: null }

  const banker = await prisma.banker.upsert({
    where: { branchId_name: { branchId: branch.id, name: input.bankerName.trim() } },
    update: {
      ...(input.bankerPhone ? { phone: input.bankerPhone } : {}),
      ...(input.bankerEmail ? { email: input.bankerEmail } : {}),
    },
    create: {
      branchId: branch.id,
      name: input.bankerName.trim(),
      phone: input.bankerPhone ?? null,
      email: input.bankerEmail ?? null,
    },
  })

  return { bankId: bank.id, branchId: branch.id, bankerId: banker.id }
}

bankAppsRouter.get(
  '/',
  handler(async (req, res) => {
    const { q, status, fileId, bankId } = req.query as Record<string, string>
    const { take, skip } = parsePaging(req.query)

    const where = {
      ...(status ? { status: status as BankApplicationStatus } : {}),
      ...(fileId ? { fileId } : {}),
      ...(bankId ? { bankId } : {}),
      ...(q
        ? {
            OR: [
              { bank: { name: { contains: q, mode: 'insensitive' as const } } },
              { file: { fileNumber: { contains: q, mode: 'insensitive' as const } } },
              {
                file: { client: { fullName: { contains: q, mode: 'insensitive' as const } } },
              },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.bankApplication.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: parseSort(req.query, APPLICATION_SORTS, [
          { isChosen: 'desc' },
          { updatedAt: 'desc' },
        ]),
        take,
        skip,
      }),
      prisma.bankApplication.count({ where }),
    ])

    res.json({ items, total })
  }),
)

bankAppsRouter.post(
  '/',
  handler(async (req, res) => {
    const { bankName, branchName, bankerName, bankerPhone, bankerEmail, ...rest } =
      appSchema.parse(req.body)

    if (!(await prisma.mortgageFile.findUnique({ where: { id: rest.fileId } }))) {
      throw new HttpError(400, 'התיק שנבחר לא קיים')
    }

    const contacts = await resolveContacts({
      bankName,
      branchName,
      bankerName,
      bankerPhone,
      bankerEmail,
    })

    const application = await withSeq('bankApplication', rest.fileId, (seq) =>
      prisma.bankApplication.create({
        data: { ...rest, seq, ...contacts },
        include: LIST_INCLUDE,
      }),
    )
    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: application.fileId,
      actorId: req.user!.id,
      action: `הגשת בקשה — ${application.bank.name}`,
    })
    res.status(201).json(application)
  }),
)

bankAppsRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const { bankName, branchName, bankerName, bankerPhone, bankerEmail, ...rest } =
      appSchema.partial().parse(req.body)

    const before = await prisma.bankApplication.findUnique({ where: { id: req.params.id } })
    if (!before) throw new HttpError(404, 'הבקשה לא נמצאה')

    const contacts = bankName
      ? await resolveContacts({ bankName, branchName, bankerName, bankerPhone, bankerEmail })
      : {}

    // Choosing one offer un-chooses whichever held it before, so a file never
    // shows two banks as the one that was taken.
    if (rest.isChosen === true) {
      await prisma.bankApplication.updateMany({
        where: { fileId: before.fileId, isChosen: true, id: { not: before.id } },
        data: { isChosen: false },
      })
    }

    const application = await prisma.bankApplication.update({
      where: { id: req.params.id },
      data: { ...rest, ...contacts },
      include: LIST_INCLUDE,
    })

    await logActivity({
      entityType: 'BANK_APPLICATION',
      entityId: application.id,
      actorId: req.user!.id,
      action:
        rest.status && rest.status !== before.status ? 'שינוי סטטוס בקשה' : 'עדכון בקשה לבנק',
      changes: diff(before, rest),
    })
    if (rest.status && rest.status !== before.status) {
      await logActivity({
        entityType: 'MORTGAGE_FILE',
        entityId: application.fileId,
        actorId: req.user!.id,
        action: `${application.bank.name} — סטטוס הבקשה עודכן`,
      })
    }

    if (rest.isChosen === true && !before.isChosen) {
      await logActivity({
        entityType: 'MORTGAGE_FILE',
        entityId: application.fileId,
        actorId: req.user!.id,
        action: `נבחר הבנק — ${application.bank.name}`,
      })
    }

    res.json(application)
  }),
)

bankAppsRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const application = await prisma.bankApplication.findUnique({
      where: { id: req.params.id },
      include: { bank: true },
    })
    if (!application) throw new HttpError(404, 'הבקשה לא נמצאה')

    await prisma.bankApplication.delete({ where: { id: req.params.id } })
    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: application.fileId,
      actorId: req.user!.id,
      action: `מחיקת בקשה — ${application.bank.name}`,
    })
    res.status(204).end()
  }),
)

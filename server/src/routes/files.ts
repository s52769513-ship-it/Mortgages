import { Router } from 'express'
import { z } from 'zod'
import { FileStage, FileStatus, Urgency } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { diff, logActivity } from '../lib/activity.js'
import { parsePaging, parseSort } from '../lib/listing.js'
import { buildBankPackage } from '../services/filePackage.js'

const FILE_SORTS = [
  'fileNumber',
  'stage',
  'status',
  'urgency',
  'requestedAmount',
  'nextActionDate',
  'updatedAt',
  'client.fullName',
] as const

export const filesRouter = Router()
filesRouter.use(requireAuth)

const decimal = z.coerce.number().nonnegative().nullish()

const fileSchema = z.object({
  clientId: z.string().min(1, 'נדרש לקוח'),
  ownerId: z.string().nullish(),
  agencyFee: decimal,
  dealType: z.string().nullish(),
  propertyType: z.string().nullish(),
  propertyAddress: z.string().nullish(),
  purchasePrice: decimal,
  propertyValue: decimal,
  requestedAmount: decimal,
  ltvPercent: z.coerce.number().min(0).max(100).nullish(),
  equity: decimal,
  desiredMonthly: decimal,
  requiredIncome: decimal,
  borrowersIncome: decimal,
  existingLiabilities: z.string().nullish(),
  nextPaymentDate: z.coerce.date().nullish(),
  executionDeadline: z.coerce.date().nullish(),
  targetBankId: z.string().nullish(),
  stage: z.nativeEnum(FileStage).optional(),
  status: z.nativeEnum(FileStatus).optional(),
  urgency: z.nativeEnum(Urgency).optional(),
  blockReason: z.string().nullish(),
  lastAction: z.string().nullish(),
  nextAction: z.string().nullish(),
  nextActionDate: z.coerce.date().nullish(),
})

/** Sequential file number: MF-2026-0001 */
async function nextFileNumber() {
  const year = new Date().getFullYear()
  const prefix = `MF-${year}-`
  const last = await prisma.mortgageFile.findFirst({
    where: { fileNumber: { startsWith: prefix } },
    orderBy: { fileNumber: 'desc' },
    select: { fileNumber: true },
  })
  const seq = last ? Number(last.fileNumber.slice(prefix.length)) + 1 : 1
  return prefix + String(seq).padStart(4, '0')
}

filesRouter.get(
  '/',
  handler(async (req, res) => {
    const { q, stage, status, urgency, ownerId, clientId } = req.query as Record<string, string>
    const { take, skip } = parsePaging(req.query)

    const where = {
      ...(stage ? { stage: stage as FileStage } : {}),
      ...(status ? { status: status as FileStatus } : {}),
      ...(urgency ? { urgency: urgency as Urgency } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(q
        ? {
            OR: [
              { fileNumber: { contains: q, mode: 'insensitive' as const } },
              { propertyAddress: { contains: q, mode: 'insensitive' as const } },
              { client: { fullName: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.mortgageFile.findMany({
        where,
        include: {
          client: { select: { id: true, fullName: true, phone: true } },
          owner: { select: { id: true, name: true } },
          targetBank: { select: { id: true, name: true } },
          _count: { select: { tasks: true, documents: true, bankApps: true } },
        },
        orderBy: parseSort(req.query, FILE_SORTS, [{ urgency: 'desc' }, { updatedAt: 'desc' }]),
        take,
        skip,
      }),
      prisma.mortgageFile.count({ where }),
    ])

    res.json({ items, total })
  }),
)

filesRouter.get(
  '/:id',
  handler(async (req, res) => {
    const file = await prisma.mortgageFile.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        owner: { select: { id: true, name: true } },
        targetBank: true,
        tasks: {
          include: { owner: { select: { id: true, name: true } } },
          orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
        },
        documents: { orderBy: { createdAt: 'desc' } },
        bankApps: {
          include: { bank: true, branch: true, banker: true },
          orderBy: [{ isChosen: 'desc' }, { createdAt: 'desc' }],
        },
        expenses: { orderBy: { spentAt: 'desc' } },
        professionals: { include: { professional: true } },
      },
    })
    if (!file) throw new HttpError(404, 'התיק לא נמצא')
    res.json(file)
  }),
)

/**
 * The whole file as one PDF, ready to hand to a bank. A GET, so it can be
 * opened by a plain link and carried by the session cookie — a download
 * cannot send an Authorization header.
 */
filesRouter.get(
  '/:id/package',
  handler(async (req, res) => {
    const { bytes, fileName, asciiName, attached, skipped } = await buildBankPackage(req.params.id)

    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: req.params.id,
      actorId: req.user!.id,
      action: `הופקה חבילה לבנק — ${attached} מסמכים${skipped.length ? `, ${skipped.length} לא צורפו` : ''}`,
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    )
    res.send(Buffer.from(bytes))
  }),
)

filesRouter.post(
  '/',
  handler(async (req, res) => {
    const data = fileSchema.parse(req.body)

    const client = await prisma.client.findUnique({ where: { id: data.clientId } })
    if (!client) throw new HttpError(400, 'הלקוח שנבחר לא קיים')

    const file = await prisma.mortgageFile.create({
      // The clock on "how long has it stood here" starts now.
      data: { ...data, fileNumber: await nextFileNumber(), stageEnteredAt: new Date() },
      include: { client: { select: { id: true, fullName: true } } },
    })
    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: file.id,
      actorId: req.user!.id,
      action: `פתיחת תיק ${file.fileNumber}`,
    })
    res.status(201).json(file)
  }),
)

filesRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const data = fileSchema.partial().parse(req.body)
    const before = await prisma.mortgageFile.findUnique({ where: { id: req.params.id } })
    if (!before) throw new HttpError(404, 'התיק לא נמצא')

    const movedStage = Boolean(data.stage && data.stage !== before.stage)
    const file = await prisma.mortgageFile.update({
      where: { id: req.params.id },
      // Only a move restarts the clock; editing anything else leaves it alone.
      data: movedStage ? { ...data, stageEnteredAt: new Date() } : data,
    })

    // Stage and status moves are the events the office actually tracks — label them plainly.
    const changes = diff(before, data)
    const action = movedStage
      ? 'שינוי שלב'
        : data.status && data.status !== before.status
          ? 'שינוי מצב התיק'
          : 'עדכון תיק'

    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: file.id,
      actorId: req.user!.id,
      action,
      changes,
    })
    res.json(file)
  }),
)

filesRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const file = await prisma.mortgageFile.findUnique({ where: { id: req.params.id } })
    if (!file) throw new HttpError(404, 'התיק לא נמצא')

    await prisma.mortgageFile.delete({ where: { id: req.params.id } })
    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: req.params.id,
      actorId: req.user!.id,
      action: `מחיקת תיק ${file.fileNumber}`,
    })
    res.status(204).end()
  }),
)

import { Router } from 'express'
import { z } from 'zod'
import { Availability, ClientPriority, ContactMethod, LeadStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { diff, logActivity } from '../lib/activity.js'
import { parsePaging, parseSort } from '../lib/listing.js'
import { deleteClientDeep } from '../services/deletion.js'

const CLIENT_SORTS = ['fullName', 'leadStatus', 'createdAt', 'updatedAt'] as const

export const clientsRouter = Router()
clientsRouter.use(requireAuth)

const clientSchema = z.object({
  fullName: z.string().min(2, 'שם מלא חייב להכיל לפחות 2 תווים'),
  phone: z.string().min(6, 'מספר טלפון לא תקין'),
  email: z.string().email('כתובת אימייל לא תקינה').nullish().or(z.literal('')),
  leadStatus: z.nativeEnum(LeadStatus).optional(),
  referralSource: z.string().nullish(),
  referralDate: z.coerce.date().nullish(),
  inquiryType: z.string().nullish(),
  inquiryStatus: z.string().nullish(),
  ownerId: z.string().nullish(),
  preferredContact: z.nativeEnum(ContactMethod).optional(),
  doNotContact: z.boolean().optional(),
  introNotes: z.string().nullish(),

  // Taken at intake, from what the client says. Nothing here is evidence.
  partnerName: z.string().nullish(),
  partnerPhone: z.string().nullish(),
  declaredIncome: z.coerce.number().nonnegative().nullish(),
  declaredAssets: z.string().nullish(),
  declaredLiabilities: z.string().nullish(),
  targetDate: z.coerce.date().nullish(),
  agreedFee: z.coerce.number().nonnegative().nullish(),
  priorities: z.array(z.nativeEnum(ClientPriority)).optional(),
  prioritiesNote: z.string().nullish(),
  availEmail: z.nativeEnum(Availability).nullish(),
  availWhatsapp: z.nativeEnum(Availability).nullish(),
  availPhone: z.nativeEnum(Availability).nullish(),
})

clientsRouter.get(
  '/',
  handler(async (req, res) => {
    const { q, status, ownerId } = req.query as Record<string, string>
    const { take, skip } = parsePaging(req.query)

    const where = {
      ...(status ? { leadStatus: status as LeadStatus } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' as const } },
              { phone: { contains: q } },
              { email: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true } },
          _count: { select: { files: true } },
        },
        orderBy: parseSort(req.query, CLIENT_SORTS, { updatedAt: 'desc' }),
        take,
        skip,
      }),
      prisma.client.count({ where }),
    ])

    res.json({ items, total })
  }),
)

clientsRouter.get(
  '/:id',
  handler(async (req, res) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true } },
        files: {
          select: {
            id: true,
            fileNumber: true,
            stage: true,
            status: true,
            urgency: true,
            requestedAmount: true,
            propertyAddress: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    })
    if (!client) throw new HttpError(404, 'הלקוח לא נמצא')
    res.json(client)
  }),
)

clientsRouter.post(
  '/',
  handler(async (req, res) => {
    const data = clientSchema.parse(req.body)
    const client = await prisma.client.create({
      data: { ...data, email: data.email || null },
    })
    await logActivity({
      entityType: 'CLIENT',
      entityId: client.id,
      actorId: req.user!.id,
      action: 'יצירת לקוח',
    })
    res.status(201).json(client)
  }),
)

clientsRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const data = clientSchema.partial().parse(req.body)
    const before = await prisma.client.findUnique({ where: { id: req.params.id } })
    if (!before) throw new HttpError(404, 'הלקוח לא נמצא')

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { ...data, ...(data.email === '' ? { email: null } : {}) },
    })
    await logActivity({
      entityType: 'CLIENT',
      entityId: client.id,
      actorId: req.user!.id,
      action: 'עדכון לקוח',
      changes: diff(before, data),
    })
    res.json(client)
  }),
)

/**
 * Deleting a client takes their mortgage files with them, and everything
 * hanging off those files. That is too much to do by accident, so it happens
 * only when the caller says in the request that it knows: `?withFiles=1`.
 * Without it a client who still has files is refused, and the refusal names
 * how many, so the screen can say what it is asking about.
 */
clientsRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { files: true } } },
    })
    if (!client) throw new HttpError(404, 'הלקוח לא נמצא')

    const withFiles = req.query.withFiles === '1' || req.query.withFiles === 'true'
    const fileCount = client._count.files
    if (fileCount > 0 && !withFiles) {
      throw new HttpError(
        409,
        `ללקוח ${fileCount} תיקי משכנתא. מחיקת הלקוח תמחק גם אותם, ויש לאשר זאת במפורש.`,
      )
    }

    await deleteClientDeep(req.params.id)
    await logActivity({
      entityType: 'CLIENT',
      entityId: req.params.id,
      actorId: req.user!.id,
      action: fileCount
        ? `מחיקת לקוח ${client.fullName} ו-${fileCount} תיקים`
        : `מחיקת לקוח ${client.fullName}`,
    })
    res.status(204).end()
  }),
)

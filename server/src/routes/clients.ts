import { Router } from 'express'
import { z } from 'zod'
import { LeadStatus, ContactMethod } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { diff, logActivity } from '../lib/activity.js'

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
})

clientsRouter.get(
  '/',
  handler(async (req, res) => {
    const { q, status, ownerId, take = '50', skip = '0' } = req.query as Record<string, string>

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
        orderBy: { updatedAt: 'desc' },
        take: Math.min(Number(take) || 50, 200),
        skip: Number(skip) || 0,
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

clientsRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { files: true } } },
    })
    if (!client) throw new HttpError(404, 'הלקוח לא נמצא')
    if (client._count.files > 0) {
      throw new HttpError(409, 'לא ניתן למחוק לקוח עם תיקי משכנתא פעילים')
    }

    await prisma.client.delete({ where: { id: req.params.id } })
    await logActivity({
      entityType: 'CLIENT',
      entityId: req.params.id,
      actorId: req.user!.id,
      action: 'מחיקת לקוח',
    })
    res.status(204).end()
  }),
)

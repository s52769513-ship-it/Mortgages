import { Router } from 'express'
import { z } from 'zod'
import { CommunicationType } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError, sendError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { logActivity } from '../lib/activity.js'
import { upload, uploadErrorMessage } from '../lib/storage.js'

export const communicationsRouter = Router()
communicationsRouter.use(requireAuth)

const LIST_INCLUDE = {
  author: { select: { id: true, name: true } },
  followUpTask: { select: { id: true, title: true, status: true, seq: true } },
  attachments: {
    select: { id: true, docType: true, fileName: true, storagePath: true, mimeType: true },
  },
  file: { select: { id: true, fileNumber: true, client: { select: { fullName: true } } } },
} as const

const communicationSchema = z.object({
  fileId: z.string().min(1, 'נדרש תיק'),
  occurredAt: z.coerce.date().optional(),
  type: z.nativeEnum(CommunicationType),
  direction: z.enum(['IN', 'OUT']).nullish(),
  sender: z.string().nullish(),
  recipient: z.string().nullish(),
  subject: z.string().nullish(),
  summary: z.string().nullish(),
  body: z.string().nullish(),
  followUpTaskId: z.string().nullish(),
  attachmentIds: z.array(z.string()).optional(),
})

communicationsRouter.get(
  '/',
  handler(async (req, res) => {
    const { fileId, type, q, take = '100', skip = '0' } = req.query as Record<string, string>

    const where = {
      ...(fileId ? { fileId } : {}),
      ...(type ? { type: type as CommunicationType } : {}),
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: 'insensitive' as const } },
              { summary: { contains: q, mode: 'insensitive' as const } },
              { body: { contains: q, mode: 'insensitive' as const } },
              { sender: { contains: q, mode: 'insensitive' as const } },
              { recipient: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.communication.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { occurredAt: 'desc' },
        take: Math.min(Number(take) || 100, 200),
        skip: Number(skip) || 0,
      }),
      prisma.communication.count({ where }),
    ])

    res.json({ items, total })
  }),
)

communicationsRouter.post(
  '/',
  (req, res, next) =>
    upload.single('file')(req, res, (err) => {
      const message = uploadErrorMessage(err)
      if (message) return sendError(res, new HttpError(413, message))
      if (err) return sendError(res, err)
      next()
    }),
  handler(async (req, res) => {
    // Multipart delivers everything as strings; coerce the two that are not.
    const raw = req.file
      ? {
          ...req.body,
          attachmentIds: undefined,
          ...(req.body.occurredAt ? { occurredAt: req.body.occurredAt } : {}),
        }
      : req.body

    const { attachmentIds, ...data } = communicationSchema.parse(raw)

    const file = await prisma.mortgageFile.findUnique({ where: { id: data.fileId } })
    if (!file) throw new HttpError(400, 'התיק שנבחר לא קיים')

    const communication = await prisma.communication.create({
      data: {
        ...data,
        authorId: req.user!.id,
        occurredAt: data.occurredAt ?? new Date(),
        // A file uploaded here becomes a document on the same mortgage file, so
        // it shows up in the document list too rather than hiding in a thread.
        ...(req.file
          ? {
              attachments: {
                create: {
                  docType: data.subject?.trim() || 'קובץ מתקשורת',
                  fileName: req.file.originalname,
                  storagePath: req.file.filename,
                  mimeType: req.file.mimetype,
                  sizeBytes: req.file.size,
                  status: 'RECEIVED',
                  receivedAt: new Date(),
                  fileId: file.id,
                  clientId: file.clientId,
                  source: 'תקשורת',
                },
              },
            }
          : attachmentIds?.length
            ? { attachments: { connect: attachmentIds.map((id) => ({ id })) } }
            : {}),
      },
      include: LIST_INCLUDE,
    })

    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: file.id,
      actorId: req.user!.id,
      action: `תקשורת נרשמה — ${communication.subject || communication.type}`,
    })

    res.status(201).json(communication)
  }),
)

communicationsRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const { attachmentIds, ...data } = communicationSchema.partial().parse(req.body)

    if (!(await prisma.communication.findUnique({ where: { id: req.params.id } }))) {
      throw new HttpError(404, 'הרישום לא נמצא')
    }

    res.json(
      await prisma.communication.update({
        where: { id: req.params.id },
        data: {
          ...data,
          ...(attachmentIds ? { attachments: { set: attachmentIds.map((id) => ({ id })) } } : {}),
        },
        include: LIST_INCLUDE,
      }),
    )
  }),
)

communicationsRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const communication = await prisma.communication.findUnique({ where: { id: req.params.id } })
    if (!communication) throw new HttpError(404, 'הרישום לא נמצא')

    await prisma.communication.delete({ where: { id: req.params.id } })
    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: communication.fileId,
      actorId: req.user!.id,
      action: `מחיקת רישום תקשורת — ${communication.subject || communication.type}`,
    })
    res.status(204).end()
  }),
)

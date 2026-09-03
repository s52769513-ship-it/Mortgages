import { Router } from 'express'
import { z } from 'zod'
import { EntityType } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError, sendError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { resolveStored, upload, uploadErrorMessage } from '../lib/storage.js'

export const commentsRouter = Router()
commentsRouter.use(requireAuth)

const paramsSchema = z.object({
  entityType: z.nativeEnum(EntityType),
  entityId: z.string().min(1),
})

const COMMENT_INCLUDE = {
  author: { select: { id: true, name: true, role: true } },
  mentions: { select: { id: true, name: true } },
  attachments: true,
} as const

/** Mentions arrive as an array in JSON and as a repeated field in multipart. */
function readMentions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string')
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [raw]
    } catch {
      return raw.split(',').map((v) => v.trim()).filter(Boolean)
    }
  }
  return []
}

commentsRouter.get(
  '/:entityType/:entityId',
  handler(async (req, res) => {
    const { entityType, entityId } = paramsSchema.parse(req.params)
    const comments = await prisma.comment.findMany({
      where: { entityType, entityId },
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    })
    res.json(comments)
  }),
)

commentsRouter.post(
  '/:entityType/:entityId',
  (req, res, next) =>
    upload.single('file')(req, res, (err) => {
      const message = uploadErrorMessage(err)
      if (message) return sendError(res, new HttpError(413, message))
      if (err) return sendError(res, err)
      next()
    }),
  handler(async (req, res) => {
    const { entityType, entityId } = paramsSchema.parse(req.params)

    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
    const mentionIds = readMentions(req.body?.mentions)
    const uploaded = req.file
    const isVoice = req.body?.kind === 'VOICE'
    const durationMs = Number(req.body?.durationMs)

    // A message needs something in it: words, a file, or a recording.
    if (!body && !uploaded) throw new HttpError(400, 'לא ניתן לשלוח הודעה ריקה')
    if (body.length > 5000) throw new HttpError(400, 'ההודעה ארוכה מדי')

    const comment = await prisma.comment.create({
      data: {
        entityType,
        entityId,
        authorId: req.user!.id,
        body: body || (isVoice ? 'הודעה קולית' : uploaded!.originalname),
        ...(mentionIds.length ? { mentions: { connect: mentionIds.map((id) => ({ id })) } } : {}),
        ...(uploaded
          ? {
              attachments: {
                create: {
                  kind: isVoice ? 'VOICE' : 'FILE',
                  fileName: uploaded.originalname,
                  mimeType: uploaded.mimetype,
                  sizeBytes: uploaded.size,
                  storageKey: uploaded.filename,
                  durationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : null,
                },
              },
            }
          : {}),
      },
      include: COMMENT_INCLUDE,
    })

    // Nobody needs telling about their own message.
    const recipients = mentionIds.filter((id) => id !== req.user!.id)
    if (recipients.length) {
      await prisma.notification.createMany({
        data: recipients.map((recipientId) => ({
          recipientId,
          actorId: req.user!.id,
          entityType,
          entityId,
          commentId: comment.id,
          preview: comment.body.slice(0, 160),
        })),
      })
    }

    res.status(201).json(comment)
  }),
)

commentsRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const { body } = z
      .object({ body: z.string().trim().min(1, 'לא ניתן לשלוח הודעה ריקה').max(5000) })
      .parse(req.body)

    const existing = await prisma.comment.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'ההודעה לא נמצאה')
    if (existing.authorId !== req.user!.id) {
      throw new HttpError(403, 'ניתן לערוך רק הודעות שכתבת')
    }

    const comment = await prisma.comment.update({
      where: { id: req.params.id },
      data: { body, editedAt: new Date() },
      include: COMMENT_INCLUDE,
    })
    res.json(comment)
  }),
)

commentsRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const existing = await prisma.comment.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'ההודעה לא נמצאה')
    if (existing.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new HttpError(403, 'ניתן למחוק רק הודעות שכתבת')
    }

    await prisma.comment.delete({ where: { id: req.params.id } })
    res.status(204).end()
  }),
)

/** Serves an attachment to a signed-in user, by id rather than by path. */
commentsRouter.get(
  '/attachments/:id/file',
  handler(async (req, res) => {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } })
    if (!attachment) throw new HttpError(404, 'הקובץ לא נמצא')

    res.type(attachment.mimeType)
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    )
    res.sendFile(resolveStored(attachment.storageKey))
  }),
)

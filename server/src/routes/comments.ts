import { Router } from 'express'
import { z } from 'zod'
import { EntityType } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

export const commentsRouter = Router()
commentsRouter.use(requireAuth)

const paramsSchema = z.object({
  entityType: z.nativeEnum(EntityType),
  entityId: z.string().min(1),
})

const bodySchema = z.object({
  body: z.string().trim().min(1, 'לא ניתן לשלוח הודעה ריקה').max(5000, 'ההודעה ארוכה מדי'),
})

// Internal chat thread for any entity: client, file, task, document, bank application.
commentsRouter.get(
  '/:entityType/:entityId',
  handler(async (req, res) => {
    const { entityType, entityId } = paramsSchema.parse(req.params)
    const comments = await prisma.comment.findMany({
      where: { entityType, entityId },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(comments)
  }),
)

commentsRouter.post(
  '/:entityType/:entityId',
  handler(async (req, res) => {
    const { entityType, entityId } = paramsSchema.parse(req.params)
    const { body } = bodySchema.parse(req.body)

    const comment = await prisma.comment.create({
      data: { entityType, entityId, authorId: req.user!.id, body },
      include: { author: { select: { id: true, name: true, role: true } } },
    })
    res.status(201).json(comment)
  }),
)

commentsRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const { body } = bodySchema.parse(req.body)
    const existing = await prisma.comment.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'ההודעה לא נמצאה')
    if (existing.authorId !== req.user!.id) {
      throw new HttpError(403, 'ניתן לערוך רק הודעות שכתבת')
    }

    const comment = await prisma.comment.update({
      where: { id: req.params.id },
      data: { body, editedAt: new Date() },
      include: { author: { select: { id: true, name: true, role: true } } },
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

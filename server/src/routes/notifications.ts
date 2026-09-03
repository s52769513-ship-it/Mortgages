import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

export const notificationsRouter = Router()
notificationsRouter.use(requireAuth)

/** Only ever the signed-in user's own notifications. */
notificationsRouter.get(
  '/',
  handler(async (req, res) => {
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: req.user!.id },
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({ where: { recipientId: req.user!.id, readAt: null } }),
    ])
    res.json({ items, unread })
  }),
)

notificationsRouter.post(
  '/:id/read',
  handler(async (req, res) => {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!notification || notification.recipientId !== req.user!.id) {
      throw new HttpError(404, 'ההתראה לא נמצאה')
    }

    res.json(
      await prisma.notification.update({
        where: { id: req.params.id },
        data: { readAt: notification.readAt ?? new Date() },
      }),
    )
  }),
)

notificationsRouter.post(
  '/read-all',
  handler(async (req, res) => {
    const { count } = await prisma.notification.updateMany({
      where: { recipientId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    })
    res.json({ marked: count })
  }),
)

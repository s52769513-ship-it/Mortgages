import { Router } from 'express'
import { z } from 'zod'
import { EntityType } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

export const activityRouter = Router()
activityRouter.use(requireAuth)

activityRouter.get(
  '/:entityType/:entityId',
  handler(async (req, res) => {
    const { entityType, entityId } = z
      .object({ entityType: z.nativeEnum(EntityType), entityId: z.string().min(1) })
      .parse(req.params)

    const logs = await prisma.activityLog.findMany({
      where: { entityType, entityId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    res.json(logs)
  }),
)

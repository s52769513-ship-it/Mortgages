import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { handler } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

export const searchRouter = Router()
searchRouter.use(requireAuth)

const PER_GROUP = 5

/**
 * One box over the things people look for by name: a client, a file, or a
 * document. Results stay grouped by type so the answer is legible without
 * reading every row.
 */
searchRouter.get(
  '/',
  handler(async (req, res) => {
    const { q } = z.object({ q: z.string().trim().default('') }).parse(req.query)

    if (q.length < 2) return res.json({ clients: [], files: [], documents: [] })

    const contains = { contains: q, mode: 'insensitive' as const }

    const [clients, files, documents] = await Promise.all([
      prisma.client.findMany({
        where: { OR: [{ fullName: contains }, { phone: { contains: q } }, { email: contains }] },
        select: { id: true, fullName: true, phone: true, leadStatus: true },
        take: PER_GROUP,
      }),
      prisma.mortgageFile.findMany({
        where: {
          OR: [
            { fileNumber: contains },
            { propertyAddress: contains },
            { client: { fullName: contains } },
          ],
        },
        select: {
          id: true,
          fileNumber: true,
          stage: true,
          status: true,
          propertyAddress: true,
          client: { select: { fullName: true } },
        },
        take: PER_GROUP,
      }),
      prisma.document.findMany({
        where: { OR: [{ docType: contains }, { fileName: contains }] },
        select: {
          id: true,
          docType: true,
          status: true,
          seq: true,
          fileId: true,
          file: { select: { fileNumber: true, client: { select: { fullName: true } } } },
        },
        take: PER_GROUP,
      }),
    ])

    res.json({ clients, files, documents })
  }),
)

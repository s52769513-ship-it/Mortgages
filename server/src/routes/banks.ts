import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { importBanks } from '../services/importBanks.js'

export const banksRouter = Router()
banksRouter.use(requireAuth)

const LIMIT = 20

const query = z.object({ q: z.string().trim().optional() })

/**
 * Type-ahead sources for the bank application form. Each returns a short list,
 * because the official branch list runs to thousands of rows and the field is
 * meant to be typed into, not scrolled.
 */

banksRouter.get(
  '/',
  handler(async (req, res) => {
    const { q } = query.parse(req.query)

    const banks = await prisma.bank.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { startsWith: q } }] }
        : undefined,
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
      take: LIMIT,
    })
    res.json(banks.map((b) => ({ id: b.id, label: b.name, hint: b.code })))
  }),
)

banksRouter.get(
  '/:bankId/branches',
  handler(async (req, res) => {
    const { q } = query.parse(req.query)

    const branches = await prisma.bankBranch.findMany({
      where: {
        bankId: req.params.bankId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { code: { startsWith: q } },
                { city: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, code: true, city: true },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      take: LIMIT,
    })
    res.json(
      branches.map((b) => ({
        id: b.id,
        label: b.city ? `${b.name} · ${b.city}` : b.name,
        hint: b.code,
        name: b.name,
      })),
    )
  }),
)

banksRouter.get(
  '/branches/:branchId/bankers',
  handler(async (req, res) => {
    const { q } = query.parse(req.query)

    const bankers = await prisma.banker.findMany({
      where: {
        branchId: req.params.branchId,
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { name: 'asc' },
      take: LIMIT,
    })
    res.json(
      bankers.map((b) => ({
        id: b.id,
        label: b.name,
        hint: b.phone,
        phone: b.phone,
        email: b.email,
      })),
    )
  }),
)

/**
 * Pulls the published list into our tables. Exposed as an endpoint because a
 * hosted service does not necessarily give anyone a shell, and it is safe to
 * re-run: existing rows are updated, and nothing typed by hand is removed.
 */
banksRouter.post(
  '/import',
  requireRole('ADMIN'),
  handler(async (_req, res) => {
    try {
      res.json(await importBanks())
    } catch (e) {
      if (e instanceof HttpError) throw e
      // This is an operator-triggered action, so the real message is more use
      // than a generic failure.
      throw new HttpError(500, `הייבוא נכשל: ${e instanceof Error ? e.message : String(e)}`)
    }
  }),
)

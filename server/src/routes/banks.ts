import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { importBanks } from '../services/importBanks.js'
import { getSetting } from './settings.js'

export const banksRouter = Router()
banksRouter.use(requireAuth)

const LIMIT = 20

const query = z.object({ q: z.string().trim().optional() })

/**
 * Type-ahead sources for the bank application form. Each returns a short list,
 * because the official branch list runs to thousands of rows and the field is
 * meant to be typed into, not scrolled.
 */

/**
 * The lenders the office works with, as configured in Settings.
 *
 * The table itself holds every bank in the country once the official list is
 * imported, which is the wrong thing to offer someone opening a file. The
 * configured names are the whole menu; a row is created for a name the first
 * time it is needed, so choosing one still yields a real bank to hang an
 * application, a branch and a banker off.
 */
async function configuredBanks() {
  const names = await getSetting<string[]>('banks')
  if (!names?.length) return []

  const rows = await prisma.bank.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true, code: true },
  })

  const missing = names.filter((n) => !rows.some((r) => r.name === n))
  if (missing.length) {
    await prisma.bank.createMany({
      data: missing.map((name) => ({ name })),
      skipDuplicates: true,
    })
    return prisma.bank.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true, code: true },
    })
  }
  return rows
}

banksRouter.get(
  '/',
  handler(async (req, res) => {
    const { q } = query.parse(req.query)
    const banks = await configuredBanks()

    // Kept in the order the office wrote them in Settings, not alphabetical:
    // the first name on that list is usually the one it uses most.
    const names = await getSetting<string[]>('banks')
    const ordered = names
      .map((name) => banks.find((b) => b.name === name))
      .filter((b): b is NonNullable<typeof b> => Boolean(b))

    const term = q?.trim().toLowerCase()
    const matched = term
      ? ordered.filter(
          (b) => b.name.toLowerCase().includes(term) || b.code?.startsWith(term),
        )
      : ordered

    res.json(matched.slice(0, LIMIT).map((b) => ({ id: b.id, label: b.name, hint: b.code })))
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

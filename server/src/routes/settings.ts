import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

/**
 * Office-wide configuration. The table behind it is one JSON value per key —
 * what belongs in each key's value is decided here, one schema per key, not
 * by the table itself.
 *
 * The one setting today is which financing percentages show up as a quick
 * pick on a file and on a bank application: an office has a handful it uses
 * constantly (75% is the ceiling for a first apartment, for instance) and
 * typing the same number by hand each time is exactly the kind of thing a
 * settings screen exists to remove.
 */

export const settingsRouter = Router()
settingsRouter.use(requireAuth)

const SCHEMAS: Record<string, z.ZodTypeAny> = {
  ltvPresets: z
    .array(z.number().int().min(1, 'אחוז חייב להיות בין 1 ל-100').max(100))
    .min(1, 'נדרש לפחות אחוז אחד ברשימה')
    .max(12, 'עד 12 אחוזים ברשימה')
    // Order is chosen by the office, not remembered from the request — sorted
    // once here, so the picker never has to guess how to lay out the chips.
    .transform((values) => Array.from(new Set(values)).sort((a, b) => a - b)),
}

const DEFAULTS: Record<string, unknown> = {
  ltvPresets: [50, 60, 70, 75, 80],
}

settingsRouter.get(
  '/',
  handler(async (_req, res) => {
    const rows = await prisma.appSetting.findMany()
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    res.json({ ...DEFAULTS, ...byKey })
  }),
)

settingsRouter.patch(
  '/:key',
  requireRole('ADMIN'),
  handler(async (req, res) => {
    const schema = SCHEMAS[req.params.key]
    if (!schema) throw new HttpError(404, 'הגדרה לא מוכרת')

    const value = schema.parse(req.body.value)
    const row = await prisma.appSetting.upsert({
      where: { key: req.params.key },
      create: { key: req.params.key, value },
      update: { value },
    })
    res.json({ key: row.key, value: row.value })
  }),
)

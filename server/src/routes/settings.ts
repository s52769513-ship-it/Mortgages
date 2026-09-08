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

/** The five state colours the whole design system is built on — see client/src/lib/labels.ts. */
const TONES = ['neutral', 'busy', 'ok', 'wait', 'urgent'] as const

const SCHEMAS: Record<string, z.ZodTypeAny> = {
  ltvPresets: z
    .array(z.number().int().min(1, 'אחוז חייב להיות בין 1 ל-100').max(100))
    .min(1, 'נדרש לפחות אחוז אחד ברשימה')
    .max(12, 'עד 12 אחוזים ברשימה')
    // Order is chosen by the office, not remembered from the request — sorted
    // once here, so the picker never has to guess how to lay out the chips.
    .transform((values) => Array.from(new Set(values)).sort((a, b) => a - b)),

  dealTypes: z
    .array(z.string().trim().min(1).max(60))
    .min(1, 'נדרש לפחות סוג עסקה אחד ברשימה')
    .max(20, 'עד 20 סוגי עסקה ברשימה')
    // Text has no natural sort order the way a percentage does — the order
    // the office built the list in is kept, first occurrence wins.
    .transform((values) => Array.from(new Set(values.map((v) => v.trim())))),

  // The lenders this office actually works with. Every bank picker in the app
  // offers this list and nothing else — the banks table holds hundreds of rows
  // once the official list is imported, and scrolling those to find the eight
  // that matter is not a choice, it is a search.
  banks: z
    .array(z.string().trim().min(1).max(60))
    .min(1, 'נדרש לפחות בנק אחד ברשימה')
    .max(40, 'עד 40 בנקים ברשימה')
    .transform((values) => Array.from(new Set(values.map((v) => v.trim())))),

  // Which of the five state colours each file status renders in — the office's
  // own remap of a fixed palette, not a free choice of colour. The whole point
  // of the four-tone system (see labels.ts) is that decorative colour never
  // creeps in; this lets an office decide which meaning gets which tone
  // without opening that door.
  fileStatusColors: z.object({
    ACTIVE: z.enum(TONES),
    BLOCKED: z.enum(TONES),
    ON_HOLD: z.enum(TONES),
    COMPLETED: z.enum(TONES),
    CANCELLED: z.enum(TONES),
  }),
}

const DEFAULTS: Record<string, unknown> = {
  ltvPresets: [50, 60, 70, 75, 80],
  dealTypes: ['רכישת דירה', 'מחזור משכנתא', 'משכנתא לכל מטרה', 'בנייה עצמית', 'גישור'],
  banks: [
    'מזרחי טפחות',
    'מרכנתיל',
    'הפועלים',
    'דיסקונט',
    'ירושלים',
    'קרדיטו',
    'מימון ישיר',
    'פמה',
  ],
  fileStatusColors: {
    ACTIVE: 'busy',
    BLOCKED: 'urgent',
    ON_HOLD: 'wait',
    COMPLETED: 'ok',
    CANCELLED: 'neutral',
  },
}

settingsRouter.get(
  '/',
  handler(async (_req, res) => {
    const rows = await prisma.appSetting.findMany()
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    res.json({ ...DEFAULTS, ...byKey })
  }),
)

/**
 * One setting, for the routes that have to act on it rather than display it —
 * falling back to the same default the settings screen shows, so a key the
 * office never touched still behaves exactly as it looks there.
 */
export async function getSetting<T>(key: string): Promise<T> {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return (row?.value ?? DEFAULTS[key]) as T
}

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

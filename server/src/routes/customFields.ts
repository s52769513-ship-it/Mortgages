import { Router } from 'express'
import { z } from 'zod'
import { CustomFieldType, EntityType, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { logActivity } from '../lib/activity.js'

/**
 * Fields the office adds for itself.
 *
 * They exist because a spreadsheet always has a column the system did not
 * think of, and dropping that column on import loses the only copy of it.
 * The values live in a JSON object on the record rather than in a table of
 * their own: they are read and written whole, always alongside the record.
 */

export const customFieldsRouter = Router()
customFieldsRouter.use(requireAuth)

const fieldSchema = z.object({
  entityType: z.nativeEnum(EntityType).default(EntityType.CLIENT),
  label: z.string().trim().min(1, 'נדרש שם לשדה').max(60, 'שם השדה ארוך מדי'),
  type: z.nativeEnum(CustomFieldType).default(CustomFieldType.TEXT),
  options: z.array(z.string().trim().min(1)).max(50).optional(),
})

/**
 * A handle derived from the label. Hebrew is kept as it is — a JSON key holds
 * it perfectly well, and a transliterated key would be unreadable to everyone
 * who has to look at the data later.
 */
function keyFrom(label: string) {
  return (
    label
      .trim()
      .replace(/["'`.$]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 40) || 'field'
  )
}

customFieldsRouter.get(
  '/',
  handler(async (req, res) => {
    const entityType = (req.query.entity as EntityType) || EntityType.CLIENT
    const items = await prisma.customField.findMany({
      where: { entityType },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    })
    res.json({ items })
  }),
)

customFieldsRouter.post(
  '/',
  handler(async (req, res) => {
    const data = fieldSchema.parse(req.body)

    // Two fields with the same name would be indistinguishable on screen, so
    // the second one is refused rather than silently renamed.
    const base = keyFrom(data.label)
    const clash = await prisma.customField.findFirst({
      where: { entityType: data.entityType, OR: [{ key: base }, { label: data.label }] },
    })
    if (clash) throw new HttpError(409, `כבר קיים שדה בשם "${data.label}"`)

    const last = await prisma.customField.findFirst({
      where: { entityType: data.entityType },
      orderBy: { position: 'desc' },
    })

    const field = await prisma.customField.create({
      data: {
        entityType: data.entityType,
        key: base,
        label: data.label,
        type: data.type,
        options: data.type === CustomFieldType.SELECT ? (data.options ?? []) : [],
        position: (last?.position ?? 0) + 1,
      },
    })
    await logActivity({
      entityType: data.entityType,
      entityId: field.id,
      actorId: req.user!.id,
      action: `הוספת שדה "${field.label}"`,
    })
    res.status(201).json(field)
  }),
)

customFieldsRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const data = fieldSchema.partial().omit({ entityType: true }).parse(req.body)
    const before = await prisma.customField.findUnique({ where: { id: req.params.id } })
    if (!before) throw new HttpError(404, 'השדה לא נמצא')

    // The key stays put: renaming it would orphan every value already stored.
    const field = await prisma.customField.update({
      where: { id: req.params.id },
      data: {
        ...(data.label ? { label: data.label } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.options ? { options: data.options } : {}),
      },
    })
    res.json(field)
  }),
)

customFieldsRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const field = await prisma.customField.findUnique({ where: { id: req.params.id } })
    if (!field) throw new HttpError(404, 'השדה לא נמצא')

    // The values go with the field. Leaving them would mean a column of data
    // nothing can read, which is not a kindness.
    if (field.entityType === EntityType.CLIENT) {
      await prisma.$executeRaw`UPDATE "Client" SET "custom" = "custom" - ${field.key}`
    }
    await prisma.customField.delete({ where: { id: req.params.id } })
    await logActivity({
      entityType: field.entityType,
      entityId: field.id,
      actorId: req.user!.id,
      action: `מחיקת שדה "${field.label}"`,
    })
    res.status(204).end()
  }),
)

/**
 * Keeps only values that belong to a field that exists, and stores each one
 * in the shape its field declares. Anything else is dropped: a stray key in
 * the object would never be shown and never be found again.
 */
export function normaliseCustom(
  value: unknown,
  fields: { key: string; type: CustomFieldType }[],
): Prisma.InputJsonValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const out: Record<string, string | number | boolean> = {}

  for (const field of fields) {
    const raw = source[field.key]
    if (raw === undefined || raw === null || raw === '') continue

    if (field.type === CustomFieldType.NUMBER) {
      const num = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.-]/g, ''))
      if (Number.isFinite(num)) out[field.key] = num
    } else if (field.type === CustomFieldType.BOOLEAN) {
      out[field.key] = typeof raw === 'boolean' ? raw : /^(true|1|כן|yes)$/i.test(String(raw).trim())
    } else if (field.type === CustomFieldType.DATE) {
      const parsed = raw instanceof Date ? raw : new Date(String(raw))
      if (!Number.isNaN(parsed.getTime())) out[field.key] = parsed.toISOString()
    } else {
      out[field.key] = String(raw).trim().slice(0, 2000)
    }
  }

  return out
}

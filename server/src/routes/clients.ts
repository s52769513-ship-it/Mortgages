import { Router } from 'express'
import { z } from 'zod'
import { Availability, ClientPriority, ContactMethod, EntityType, LeadStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { diff, logActivity } from '../lib/activity.js'
import { parsePaging, parseSort } from '../lib/listing.js'
import { deleteClientDeep } from '../services/deletion.js'
import { normaliseCustom } from './customFields.js'

const CLIENT_SORTS = ['fullName', 'leadStatus', 'createdAt', 'updatedAt'] as const

export const clientsRouter = Router()
clientsRouter.use(requireAuth)

const clientSchema = z.object({
  fullName: z
    .string({ required_error: 'חסר שם מלא' })
    .min(2, 'שם מלא חייב להכיל לפחות 2 תווים'),
  // Not required. The intake form asks for a number and always will, but a
  // list being imported from somewhere older may simply not have one, and a
  // name without a number is still worth keeping.
  phone: z
    .string()
    .trim()
    .min(6, 'מספר טלפון לא תקין')
    .nullish()
    .or(z.literal('')),
  email: z.string().email('כתובת אימייל לא תקינה').nullish().or(z.literal('')),
  leadStatus: z.nativeEnum(LeadStatus).optional(),
  referralSource: z.string().nullish(),
  referralDate: z.coerce.date().nullish(),
  inquiryType: z.string().nullish(),
  inquiryStatus: z.string().nullish(),
  ownerId: z.string().nullish(),
  preferredContact: z.nativeEnum(ContactMethod).optional(),
  doNotContact: z.boolean().optional(),
  introNotes: z.string().nullish(),

  // Taken at intake, from what the client says. Nothing here is evidence.
  partnerName: z.string().nullish(),
  partnerPhone: z.string().nullish(),
  declaredIncome: z.coerce.number().nonnegative().nullish(),
  declaredAssets: z.string().nullish(),
  declaredLiabilities: z.string().nullish(),
  targetDate: z.coerce.date().nullish(),
  agreedFee: z.coerce.number().nonnegative().nullish(),
  priorities: z.array(z.nativeEnum(ClientPriority)).optional(),
  prioritiesNote: z.string().nullish(),
  availEmail: z.nativeEnum(Availability).nullish(),
  availWhatsapp: z.nativeEnum(Availability).nullish(),
  availPhone: z.nativeEnum(Availability).nullish(),

  /// Values for the office's own fields; anything not declared is dropped.
  custom: z.record(z.unknown()).optional(),
})

/** Two numbers are the same number whatever punctuation was typed around them. */
const digitsOf = (phone: string | null | undefined) => (phone ?? '').replace(/\D/g, '')

async function customFieldDefs() {
  return prisma.customField.findMany({
    where: { entityType: EntityType.CLIENT },
    select: { key: true, type: true },
  })
}

clientsRouter.get(
  '/',
  handler(async (req, res) => {
    const { q, status, ownerId } = req.query as Record<string, string>
    const { take, skip } = parsePaging(req.query)

    const where = {
      ...(status ? { leadStatus: status as LeadStatus } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' as const } },
              { phone: { contains: q } },
              { email: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true } },
          _count: { select: { files: true } },
        },
        orderBy: parseSort(req.query, CLIENT_SORTS, { updatedAt: 'desc' }),
        take,
        skip,
      }),
      prisma.client.count({ where }),
    ])

    res.json({ items, total })
  }),
)

clientsRouter.get(
  '/:id',
  handler(async (req, res) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true } },
        files: {
          select: {
            id: true,
            fileNumber: true,
            stage: true,
            status: true,
            urgency: true,
            requestedAmount: true,
            propertyAddress: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    })
    if (!client) throw new HttpError(404, 'הלקוח לא נמצא')
    res.json(client)
  }),
)

clientsRouter.post(
  '/',
  handler(async (req, res) => {
    const data = clientSchema.parse(req.body)
    const { custom, ...rest } = data
    const client = await prisma.client.create({
      data: {
        ...rest,
        email: data.email || null,
        phone: data.phone || null,
        ...(custom ? { custom: normaliseCustom(custom, await customFieldDefs()) } : {}),
      },
    })
    await logActivity({
      entityType: 'CLIENT',
      entityId: client.id,
      actorId: req.user!.id,
      action: 'יצירת לקוח',
    })
    res.status(201).json(client)
  }),
)

clientsRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const data = clientSchema.partial().parse(req.body)
    const before = await prisma.client.findUnique({ where: { id: req.params.id } })
    if (!before) throw new HttpError(404, 'הלקוח לא נמצא')

    const { custom, ...rest } = data
    const fields = custom ? await customFieldDefs() : []
    // Sent whole, not merged: the edit form submits every field it knows
    // about, so a key left out of the object is a value that was cleared.
    const nextCustom = custom ? normaliseCustom(custom, fields) : undefined

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(data.email === '' ? { email: null } : {}),
        ...(data.phone === '' ? { phone: null } : {}),
        ...(nextCustom ? { custom: nextCustom } : {}),
      },
    })

    // The office's own fields are one JSON column, which would log as a single
    // unreadable change; they are compared key by key so the log stays useful.
    const previous = (before.custom ?? {}) as Record<string, unknown>
    const customChanges = nextCustom
      ? fields
          .map((f) => ({
            field: f.key,
            oldValue: previous[f.key] ?? null,
            newValue: (nextCustom as Record<string, unknown>)[f.key] ?? null,
          }))
          .filter((c) => String(c.oldValue ?? '') !== String(c.newValue ?? ''))
      : []

    await logActivity({
      entityType: 'CLIENT',
      entityId: client.id,
      actorId: req.user!.id,
      action: 'עדכון לקוח',
      changes: [...diff(before, rest), ...customChanges],
    })
    res.json(client)
  }),
)

/**
 * Deleting a client takes their mortgage files with them, and everything
 * hanging off those files. That is too much to do by accident, so it happens
 * only when the caller says in the request that it knows: `?withFiles=1`.
 * Without it a client who still has files is refused, and the refusal names
 * how many, so the screen can say what it is asking about.
 */
/**
 * Bulk import, one batch at a time.
 *
 * Rows arrive already mapped to field names by the screen that read the
 * spreadsheet — the mapping is a decision a person makes, not a guess the
 * server should be making on its own. What the server does is refuse what
 * cannot be a client, recognise a number it already holds, and report each
 * row by its line in the sheet so a failure can be found and fixed there.
 *
 * Rows are handled one at a time on purpose. A single bad row in a batch of
 * two hundred should cost that row, not the other hundred and ninety-nine.
 */
const importSchema = z.object({
  rows: z
    .array(z.object({ index: z.number().int().nonnegative(), data: z.record(z.unknown()) }))
    .min(1)
    .max(500, 'לכל היותר 500 שורות בכל מנה'),
  /** What to do with a phone number that is already in the system. */
  onDuplicate: z.enum(['skip', 'create']).default('skip'),
})

clientsRouter.post(
  '/import',
  handler(async (req, res) => {
    const { rows, onDuplicate } = importSchema.parse(req.body)
    const fields = await customFieldDefs()

    const existing = await prisma.client.findMany({ select: { phone: true } })
    const seen = new Set(existing.map((c) => digitsOf(c.phone)).filter(Boolean))


    const created: { index: number; id: string; fullName: string }[] = []
    const skipped: { index: number; reason: string }[] = []
    const failed: { index: number; message: string }[] = []

    for (const row of rows) {
      const parsed = clientSchema.safeParse(row.data)
      if (!parsed.success) {
        failed.push({
          index: row.index,
          message: parsed.error.issues.map((i) => i.message).join(', '),
        })
        continue
      }

      const digits = digitsOf(parsed.data.phone)
      if (digits && seen.has(digits) && onDuplicate === 'skip') {
        skipped.push({ index: row.index, reason: `הטלפון ${parsed.data.phone} כבר קיים במערכת` })
        continue
      }

      try {
        const { custom, ...rest } = parsed.data
        const client = await prisma.client.create({
          data: {
            ...rest,
            email: parsed.data.email || null,
            phone: parsed.data.phone || null,
            ...(custom ? { custom: normaliseCustom(custom, fields) } : {}),
          },
        })
        if (digits) seen.add(digits)
        created.push({ index: row.index, id: client.id, fullName: client.fullName })
      } catch (error) {
        failed.push({
          index: row.index,
          message: error instanceof Error ? error.message : 'שמירה נכשלה',
        })
      }
    }

    if (created.length) {
      await logActivity({
        entityType: 'CLIENT',
        entityId: created[0].id,
        actorId: req.user!.id,
        action: `ייבוא ${created.length} לקוחות מקובץ`,
      })
    }

    res.json({ created, skipped, failed })
  }),
)

clientsRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { files: true } } },
    })
    if (!client) throw new HttpError(404, 'הלקוח לא נמצא')

    const withFiles = req.query.withFiles === '1' || req.query.withFiles === 'true'
    const fileCount = client._count.files
    if (fileCount > 0 && !withFiles) {
      throw new HttpError(
        409,
        `ללקוח ${fileCount} תיקי משכנתא. מחיקת הלקוח תמחק גם אותם, ויש לאשר זאת במפורש.`,
      )
    }

    await deleteClientDeep(req.params.id)
    await logActivity({
      entityType: 'CLIENT',
      entityId: req.params.id,
      actorId: req.user!.id,
      action: fileCount
        ? `מחיקת לקוח ${client.fullName} ו-${fileCount} תיקים`
        : `מחיקת לקוח ${client.fullName}`,
    })
    res.status(204).end()
  }),
)

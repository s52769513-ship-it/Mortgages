import { Router } from 'express'
import { z } from 'zod'
import { DocumentStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError, sendError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { diff, logActivity } from '../lib/activity.js'
import { withSeq } from '../lib/sequence.js'
import { resolveStored, upload, uploadErrorMessage } from '../lib/storage.js'

export const documentsRouter = Router()
documentsRouter.use(requireAuth)

const documentSchema = z.object({
  docType: z.string().min(2, 'נדרש סוג מסמך'),
  fileName: z.string().optional(),
  fileId: z.string().min(1, 'נדרש תיק'),
  periodLabel: z.string().nullish(),
  receivedAt: z.coerce.date().nullish(),
  expiresAt: z.coerce.date().nullish(),
  status: z.nativeEnum(DocumentStatus).optional(),
  isValid: z.boolean().nullish(),
  issueNotes: z.string().nullish(),
  source: z.string().nullish(),
  notes: z.string().nullish(),
  allowedForBank: z.boolean().optional(),
})

const LIST_INCLUDE = {
  reviewedBy: { select: { id: true, name: true } },
  file: {
    select: { id: true, fileNumber: true, client: { select: { fullName: true } } },
  },
} as const

/** Statuses that still need someone to chase the document. */
const OUTSTANDING: DocumentStatus[] = ['REQUIRED', 'REQUESTED', 'UNDER_REVIEW', 'MISSING', 'INVALID']

documentsRouter.get(
  '/',
  handler(async (req, res) => {
    const { q, status, fileId, outstanding, take = '100', skip = '0' } = req.query as Record<
      string,
      string
    >

    const where = {
      ...(status ? { status: status as DocumentStatus } : {}),
      ...(fileId ? { fileId } : {}),
      ...(outstanding === '1' ? { status: { in: OUTSTANDING } } : {}),
      ...(q
        ? {
            OR: [
              { docType: { contains: q, mode: 'insensitive' as const } },
              { fileName: { contains: q, mode: 'insensitive' as const } },
              { file: { fileNumber: { contains: q, mode: 'insensitive' as const } } },
              {
                file: { client: { fullName: { contains: q, mode: 'insensitive' as const } } },
              },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: Math.min(Number(take) || 100, 200),
        skip: Number(skip) || 0,
      }),
      prisma.document.count({ where }),
    ])

    res.json({ items, total })
  }),
)

documentsRouter.post(
  '/',
  handler(async (req, res) => {
    const data = documentSchema.parse(req.body)

    const file = await prisma.mortgageFile.findUnique({ where: { id: data.fileId } })
    if (!file) throw new HttpError(400, 'התיק שנבחר לא קיים')

    const document = await withSeq('document', data.fileId, (seq) =>
      prisma.document.create({
        // The client is implied by the file, so it is filled in rather than asked for.
        data: { ...data, seq, fileName: data.fileName ?? '', clientId: file.clientId },
        include: LIST_INCLUDE,
      }),
    )
    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: file.id,
      actorId: req.user!.id,
      action: `הוספת מסמך — ${document.docType}`,
    })
    res.status(201).json(document)
  }),
)

documentsRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const data = documentSchema.partial().parse(req.body)
    const before = await prisma.document.findUnique({ where: { id: req.params.id } })
    if (!before) throw new HttpError(404, 'המסמך לא נמצא')

    const document = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        ...data,
        // Reviewing is an act by a person — record who did it.
        ...(data.status && data.status !== before.status ? { reviewedById: req.user!.id } : {}),
      },
      include: LIST_INCLUDE,
    })

    await logActivity({
      entityType: 'DOCUMENT',
      entityId: document.id,
      actorId: req.user!.id,
      action: data.status && data.status !== before.status ? 'שינוי סטטוס מסמך' : 'עדכון מסמך',
      changes: diff(before, data),
    })
    if (before.fileId) {
      await logActivity({
        entityType: 'MORTGAGE_FILE',
        entityId: before.fileId,
        actorId: req.user!.id,
        action: `עדכון מסמך — ${document.docType}`,
      })
    }

    res.json(document)
  }),
)

/** A replacement is a new version, not an overwrite — the history stays. */
documentsRouter.post(
  '/:id/version',
  handler(async (req, res) => {
    const { fileName } = z.object({ fileName: z.string().min(1) }).parse(req.body)
    const before = await prisma.document.findUnique({ where: { id: req.params.id } })
    if (!before) throw new HttpError(404, 'המסמך לא נמצא')

    const document = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        fileName,
        version: before.version + 1,
        status: 'UNDER_REVIEW',
        isValid: null,
        issueNotes: null,
        receivedAt: new Date(),
        reviewedById: req.user!.id,
      },
      include: LIST_INCLUDE,
    })

    await logActivity({
      entityType: 'DOCUMENT',
      entityId: document.id,
      actorId: req.user!.id,
      action: 'החלפת גרסת מסמך',
      changes: [{ field: 'version', oldValue: before.version, newValue: document.version }],
    })
    res.json(document)
  }),
)

documentsRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } })
    if (!document) throw new HttpError(404, 'המסמך לא נמצא')

    await prisma.document.delete({ where: { id: req.params.id } })
    if (document.fileId) {
      await logActivity({
        entityType: 'MORTGAGE_FILE',
        entityId: document.fileId,
        actorId: req.user!.id,
        action: `מחיקת מסמך — ${document.docType}`,
      })
    }
    res.status(204).end()
  }),
)

/**
 * Attaches the actual file to a document record. Uploading again supersedes
 * the previous one as a new version and sends it back for review, so the
 * history of what was received when is not overwritten.
 */
documentsRouter.post(
  '/:id/file',
  (req, res, next) =>
    upload.single('file')(req, res, (err) => {
      const message = uploadErrorMessage(err)
      if (message) return sendError(res, new HttpError(413, message))
      if (err) return sendError(res, err)
      next()
    }),
  handler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'לא צורף קובץ')

    const before = await prisma.document.findUnique({ where: { id: req.params.id } })
    if (!before) throw new HttpError(404, 'המסמך לא נמצא')

    const replacing = Boolean(before.storagePath)

    const document = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        fileName: req.file.originalname,
        storagePath: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        receivedAt: new Date(),
        status: 'UNDER_REVIEW',
        isValid: null,
        issueNotes: null,
        reviewedById: req.user!.id,
        ...(replacing ? { version: before.version + 1 } : {}),
      },
      include: LIST_INCLUDE,
    })

    await logActivity({
      entityType: 'DOCUMENT',
      entityId: document.id,
      actorId: req.user!.id,
      action: replacing ? 'החלפת גרסת מסמך' : 'העלאת מסמך',
      ...(replacing
        ? { changes: [{ field: 'version', oldValue: before.version, newValue: document.version }] }
        : {}),
    })
    if (document.fileId) {
      await logActivity({
        entityType: 'MORTGAGE_FILE',
        entityId: document.fileId,
        actorId: req.user!.id,
        action: `${replacing ? 'החלפת' : 'העלאת'} מסמך — ${document.docType}`,
      })
    }

    res.json(document)
  }),
)

documentsRouter.get(
  '/:id/file',
  handler(async (req, res) => {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } })
    if (!document?.storagePath) throw new HttpError(404, 'אין קובץ מצורף למסמך זה')

    res.type(document.mimeType ?? 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
    )
    res.sendFile(resolveStored(document.storagePath))
  }),
)

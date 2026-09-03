import { Router } from 'express'
import { z } from 'zod'
import { ProfessionalRole } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { logActivity } from '../lib/activity.js'

export const professionalsRouter = Router()
professionalsRouter.use(requireAuth)

const professionalSchema = z.object({
  role: z.nativeEnum(ProfessionalRole),
  name: z.string().min(2, 'נדרש שם'),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  organization: z.string().nullish(),
  address: z.string().nullish(),
  notes: z.string().nullish(),
})

/** The office's own address book, reused across files. */
professionalsRouter.get(
  '/',
  handler(async (req, res) => {
    const { q, role } = req.query as Record<string, string>

    const professionals = await prisma.externalProfessional.findMany({
      where: {
        ...(role ? { role: role as ProfessionalRole } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { organization: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 50,
    })
    res.json(professionals)
  }),
)

professionalsRouter.post(
  '/',
  handler(async (req, res) => {
    res.status(201).json(
      await prisma.externalProfessional.create({ data: professionalSchema.parse(req.body) }),
    )
  }),
)

professionalsRouter.patch(
  '/:id',
  handler(async (req, res) => {
    if (!(await prisma.externalProfessional.findUnique({ where: { id: req.params.id } }))) {
      throw new HttpError(404, 'איש הקשר לא נמצא')
    }
    res.json(
      await prisma.externalProfessional.update({
        where: { id: req.params.id },
        data: professionalSchema.partial().parse(req.body),
      }),
    )
  }),
)

const attachSchema = z.object({
  professionalId: z.string().min(1).optional(),
  /** When no existing contact is chosen, one is created from these details. */
  create: professionalSchema.optional(),
  roleInFile: z.nativeEnum(ProfessionalRole),
})

/**
 * Attaches a contact to a file. The same lawyer can appear on many files, and
 * one file can hold the same person under two roles, which is why the role is
 * recorded on the link rather than only on the person.
 */
professionalsRouter.post(
  '/files/:fileId',
  handler(async (req, res) => {
    const { professionalId, create, roleInFile } = attachSchema.parse(req.body)

    if (!(await prisma.mortgageFile.findUnique({ where: { id: req.params.fileId } }))) {
      throw new HttpError(404, 'התיק לא נמצא')
    }
    if (!professionalId && !create) {
      throw new HttpError(400, 'צריך לבחור איש קשר קיים או להזין פרטים חדשים')
    }

    const professional = professionalId
      ? await prisma.externalProfessional.findUnique({ where: { id: professionalId } })
      : await prisma.externalProfessional.create({ data: create! })

    if (!professional) throw new HttpError(400, 'איש הקשר שנבחר לא קיים')

    const link = await prisma.fileProfessional.upsert({
      where: {
        fileId_professionalId_roleInFile: {
          fileId: req.params.fileId,
          professionalId: professional.id,
          roleInFile,
        },
      },
      update: {},
      create: { fileId: req.params.fileId, professionalId: professional.id, roleInFile },
      include: { professional: true },
    })

    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: req.params.fileId,
      actorId: req.user!.id,
      action: `שיוך איש מקצוע — ${professional.name}`,
    })

    res.status(201).json(link)
  }),
)

professionalsRouter.delete(
  '/files/:fileId/:professionalId/:roleInFile',
  handler(async (req, res) => {
    const { fileId, professionalId } = req.params
    const roleInFile = z.nativeEnum(ProfessionalRole).parse(req.params.roleInFile)

    const link = await prisma.fileProfessional.findUnique({
      where: { fileId_professionalId_roleInFile: { fileId, professionalId, roleInFile } },
      include: { professional: true },
    })
    if (!link) throw new HttpError(404, 'השיוך לא נמצא')

    await prisma.fileProfessional.delete({
      where: { fileId_professionalId_roleInFile: { fileId, professionalId, roleInFile } },
    })
    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: fileId,
      actorId: req.user!.id,
      action: `ביטול שיוך — ${link.professional.name}`,
    })
    res.status(204).end()
  }),
)

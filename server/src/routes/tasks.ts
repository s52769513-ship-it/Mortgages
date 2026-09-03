import { Router } from 'express'
import { z } from 'zod'
import { FileStage, TaskPriority, TaskStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { diff, logActivity } from '../lib/activity.js'
import { withSeq } from '../lib/sequence.js'
import { parsePaging, parseSort } from '../lib/listing.js'

const TASK_SORTS = ['title', 'status', 'priority', 'dueAt', 'createdAt', 'seq'] as const

export const tasksRouter = Router()
tasksRouter.use(requireAuth)

export const OPEN_TASK_STATES: TaskStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'WAITING_BANK',
  'WAITING_APPRAISER',
  'WAITING_LAWYER',
  'WAITING_OTHER',
]

const isWaiting = (status: TaskStatus) => status.startsWith('WAITING_')

const taskSchema = z.object({
  title: z.string().min(2, 'שם המשימה חייב להכיל לפחות 2 תווים'),
  fileId: z.string().min(1, 'נדרש תיק'),
  stage: z.nativeEnum(FileStage).nullish(),
  ownerId: z.string().nullish(),
  dueAt: z.coerce.date().nullish(),
  priority: z.nativeEnum(TaskPriority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  waitingOn: z.string().nullish(),
  description: z.string().nullish(),
  escalationRule: z.string().nullish(),
  dependsOnId: z.string().nullish(),
  result: z.string().nullish(),
  completionNote: z.string().nullish(),
})

const LIST_INCLUDE = {
  owner: { select: { id: true, name: true } },
  file: {
    select: { id: true, fileNumber: true, client: { select: { fullName: true } } },
  },
} as const

tasksRouter.get(
  '/',
  handler(async (req, res) => {
    const { q, status, priority, ownerId, fileId, stage, scope, overdue } = req.query as Record<
      string,
      string
    >
    const { take, skip } = parsePaging(req.query)

    const where = {
      ...(status ? { status: status as TaskStatus } : {}),
      ...(priority ? { priority: priority as TaskPriority } : {}),
      ...(stage ? { stage: stage as FileStage } : {}),
      ...(fileId ? { fileId } : {}),
      // "mine" covers both owning the task and being named on it.
      ...(scope === 'mine'
        ? {
            OR: [
              { ownerId: req.user!.id },
              { participants: { some: { id: req.user!.id } } },
            ],
          }
        : ownerId
          ? { ownerId }
          : {}),
      ...(overdue === '1'
        ? { status: { in: OPEN_TASK_STATES }, dueAt: { lt: new Date() } }
        : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { title: { contains: q, mode: 'insensitive' as const } },
                  { description: { contains: q, mode: 'insensitive' as const } },
                  { file: { fileNumber: { contains: q, mode: 'insensitive' as const } } },
                  {
                    file: {
                      client: { fullName: { contains: q, mode: 'insensitive' as const } },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: parseSort(req.query, TASK_SORTS, [{ priority: 'desc' }, { dueAt: 'asc' }]),
        take,
        skip,
      }),
      prisma.task.count({ where }),
    ])

    res.json({ items, total })
  }),
)

tasksRouter.get(
  '/:id',
  handler(async (req, res) => {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        ...LIST_INCLUDE,
        participants: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        dependsOn: { select: { id: true, title: true, status: true } },
        reminders: true,
      },
    })
    if (!task) throw new HttpError(404, 'המשימה לא נמצאה')
    res.json(task)
  }),
)

tasksRouter.post(
  '/',
  handler(async (req, res) => {
    const data = taskSchema.parse(req.body)

    if (!(await prisma.mortgageFile.findUnique({ where: { id: data.fileId } }))) {
      throw new HttpError(400, 'התיק שנבחר לא קיים')
    }
    if (data.status && isWaiting(data.status) && !data.waitingOn) {
      throw new HttpError(400, 'סטטוס המתנה מחייב לציין את הגורם שממתינים לו')
    }

    const task = await withSeq('task', data.fileId, (seq) =>
      prisma.task.create({
        data: { ...data, seq, createdById: req.user!.id },
        include: LIST_INCLUDE,
      }),
    )
    await logActivity({
      entityType: 'TASK',
      entityId: task.id,
      actorId: req.user!.id,
      action: 'פתיחת משימה',
    })
    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: task.fileId,
      actorId: req.user!.id,
      action: `פתיחת משימה — ${task.title}`,
    })
    res.status(201).json(task)
  }),
)

tasksRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const data = taskSchema.partial().parse(req.body)
    const before = await prisma.task.findUnique({ where: { id: req.params.id } })
    if (!before) throw new HttpError(404, 'המשימה לא נמצאה')

    const status = data.status ?? before.status
    const waitingOn = data.waitingOn !== undefined ? data.waitingOn : before.waitingOn

    if (isWaiting(status) && !waitingOn) {
      throw new HttpError(400, 'סטטוס המתנה מחייב לציין את הגורם שממתינים לו')
    }

    // Completing stamps the time and clears whoever we were waiting on.
    const completing = status === 'COMPLETED' && before.status !== 'COMPLETED'
    const reopening = status !== 'COMPLETED' && before.status === 'COMPLETED'

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(isWaiting(status) ? {} : { waitingOn: null }),
        ...(completing ? { completedAt: new Date() } : {}),
        ...(reopening ? { completedAt: null } : {}),
      },
      include: LIST_INCLUDE,
    })

    const action = completing
      ? 'סגירת משימה'
      : data.status && data.status !== before.status
        ? 'שינוי סטטוס משימה'
        : data.ownerId !== undefined && data.ownerId !== before.ownerId
          ? 'שינוי אחראי'
          : data.dueAt !== undefined
            ? 'שינוי תאריך יעד'
            : 'עדכון משימה'

    await logActivity({
      entityType: 'TASK',
      entityId: task.id,
      actorId: req.user!.id,
      action,
      changes: diff(before, data),
    })
    if (completing) {
      await logActivity({
        entityType: 'MORTGAGE_FILE',
        entityId: task.fileId,
        actorId: req.user!.id,
        action: `סגירת משימה — ${task.title}`,
      })
    }

    res.json(task)
  }),
)

tasksRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } })
    if (!task) throw new HttpError(404, 'המשימה לא נמצאה')

    await prisma.task.delete({ where: { id: req.params.id } })
    await logActivity({
      entityType: 'MORTGAGE_FILE',
      entityId: task.fileId,
      actorId: req.user!.id,
      action: `מחיקת משימה — ${task.title}`,
    })
    res.status(204).end()
  }),
)

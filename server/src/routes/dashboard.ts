import { Router } from 'express'
import { TaskStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { handler } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

export const dashboardRouter = Router()
dashboardRouter.use(requireAuth)

/** The six pipeline steps, in order — mirrors the stepper on the file page. */
const STAGE_ORDER = [
  'INTAKE',
  'DOCUMENT_COLLECTION',
  'BANK_SUBMISSION',
  'APPROVAL_IN_PRINCIPLE',
  'COLLATERAL',
  'EXECUTION',
] as const

const OPEN_TASK_STATES: TaskStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'WAITING_BANK',
  'WAITING_APPRAISER',
  'WAITING_LAWYER',
  'WAITING_OTHER',
]

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfToday = () => {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

const startOfYesterday = () => {
  const d = startOfToday()
  d.setDate(d.getDate() - 1)
  return d
}

const endOfYesterday = () => {
  const d = startOfToday()
  d.setMilliseconds(d.getMilliseconds() - 1)
  return d
}

/** Four metrics, each one a link into the list it summarises. */
dashboardRouter.get(
  '/',
  handler(async (req, res) => {
    const userId = req.user!.id
    const now = new Date()
    const today = endOfToday()

    const yesterdayStart = startOfYesterday()
    const yesterdayEnd = endOfYesterday()

    const [
      tasksToday,
      overdueTasks,
      activeFiles,
      waitingOnBank,
      dueToday,
      blockedFiles,
      activity,
      stageRows,
      stageAges,
      // Trends — see the note where they are assembled below.
      loadToday,
      loadYesterday,
      overdueYesterday,
      filesOpenedToday,
      startedWaitingToday,
    ] = await Promise.all([
        // Due today only. Anything older is counted as overdue instead, so the
        // two numbers do not describe the same task twice.
        prisma.task.count({
          where: {
            status: { in: OPEN_TASK_STATES },
            dueAt: { gte: startOfToday(), lte: today },
          },
        }),
        prisma.task.count({
          where: { status: { in: OPEN_TASK_STATES }, dueAt: { lt: now } },
        }),
        prisma.mortgageFile.count({ where: { status: 'ACTIVE' } }),
        prisma.task.count({ where: { status: 'WAITING_BANK' } }),

        prisma.task.findMany({
          where: {
            status: { in: OPEN_TASK_STATES },
            dueAt: { lte: today },
            OR: [{ ownerId: userId }, { participants: { some: { id: userId } } }],
          },
          include: {
            owner: { select: { id: true, name: true } },
            file: {
              select: { id: true, fileNumber: true, client: { select: { fullName: true } } },
            },
          },
          orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
          take: 8,
        }),

        prisma.mortgageFile.findMany({
          where: { status: 'BLOCKED' },
          include: { client: { select: { fullName: true } } },
          orderBy: { updatedAt: 'asc' },
          take: 6,
        }),

        prisma.activityLog.findMany({
          include: { actor: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),

        // Where the open files are sitting, split by whether they are moving.
        prisma.mortgageFile.groupBy({
          by: ['stage', 'status'],
          where: { status: { in: ['ACTIVE', 'BLOCKED', 'ON_HOLD'] } },
          _count: { _all: true },
        }),

        // The oldest arrival still standing in each stage. A count says where
        // the files are; this says where they stopped moving, which is the
        // difference between a busy stage and a stuck one.
        prisma.mortgageFile.groupBy({
          by: ['stage'],
          where: { status: { in: ['ACTIVE', 'BLOCKED', 'ON_HOLD'] } },
          _min: { stageEnteredAt: true },
        }),

        // Today's scheduled load against yesterday's, counting every task
        // whatever its status. Comparing only the ones still open would put
        // today's work next to yesterday's leftovers and call it a trend.
        prisma.task.count({
          where: { dueAt: { gte: startOfToday(), lte: today } },
        }),
        prisma.task.count({
          where: { dueAt: { gte: yesterdayStart, lte: yesterdayEnd } },
        }),
        prisma.task.count({
          where: { status: { in: OPEN_TASK_STATES }, dueAt: { lt: yesterdayStart } },
        }),
        // Nothing here can fall: a file opened today, or a task that started
        // waiting today. Reported as additions, never as a change.
        prisma.mortgageFile.count({
          where: { status: 'ACTIVE', createdAt: { gte: startOfToday() } },
        }),
        prisma.task.count({
          where: { status: 'WAITING_BANK', createdAt: { gte: startOfToday() } },
        }),
      ])

    res.json({
      kpis: { tasksToday, overdueTasks, activeFiles, waitingOnBank },
      /**
       * Two different things, so the labels differ on screen: `sinceYesterday`
       * compares like with like, `addedToday` only counts what arrived.
       */
      trends: {
        tasksToday: { kind: 'sinceYesterday', value: loadToday - loadYesterday },
        overdueTasks: { kind: 'sinceYesterday', value: overdueTasks - overdueYesterday },
        activeFiles: { kind: 'addedToday', value: filesOpenedToday },
        waitingOnBank: { kind: 'addedToday', value: startedWaitingToday },
      },
      dueToday,
      // "6D · missing documents" — how long each block has been standing.
      blockedFiles: blockedFiles.map((file) => ({
        id: file.id,
        fileNumber: file.fileNumber,
        clientName: file.client.fullName,
        reason: file.blockReason,
        daysBlocked: Math.max(
          0,
          Math.floor((now.getTime() - file.updatedAt.getTime()) / 86_400_000),
        ),
      })),
      activity,
      // One row per stage, in the order the pipeline runs, including the
      // stages holding nothing — a gap in the middle is itself the finding.
      pipeline: STAGE_ORDER.map((stage) => {
        const rows = stageRows.filter((r) => r.stage === stage)
        const countFor = (status: string) =>
          rows.find((r) => r.status === status)?._count._all ?? 0

        const since = stageAges.find((a) => a.stage === stage)?._min.stageEnteredAt
        const total = countFor('ACTIVE') + countFor('BLOCKED') + countFor('ON_HOLD')

        return {
          stage,
          active: countFor('ACTIVE'),
          blocked: countFor('BLOCKED'),
          onHold: countFor('ON_HOLD'),
          /** Days the longest-standing file has been here; null when empty. */
          oldestDays:
            since && total > 0
              ? Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86_400_000))
              : null,
        }
      }),
    })
  }),
)

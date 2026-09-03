import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { handler } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

export const dashboardRouter = Router()
dashboardRouter.use(requireAuth)

const endOfToday = () => {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

const OPEN_TASK_STATES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'WAITING_BANK',
  'WAITING_APPRAISER',
  'WAITING_LAWYER',
  'WAITING_OTHER',
] as const

dashboardRouter.get(
  '/',
  handler(async (req, res) => {
    const userId = req.user!.id
    const today = endOfToday()

    const [
      activeFiles,
      blockedFiles,
      openTasks,
      overdueTasks,
      pendingDocs,
      dueToday,
      recentFiles,
      stageBreakdown,
    ] = await Promise.all([
      prisma.mortgageFile.count({ where: { status: 'ACTIVE' } }),
      prisma.mortgageFile.count({ where: { status: 'BLOCKED' } }),
      prisma.task.count({ where: { status: { in: [...OPEN_TASK_STATES] } } }),
      prisma.task.count({
        where: { status: { in: [...OPEN_TASK_STATES] }, dueAt: { lt: new Date() } },
      }),
      prisma.document.count({
        where: { status: { in: ['REQUIRED', 'REQUESTED', 'UNDER_REVIEW', 'MISSING', 'INVALID'] } },
      }),
      prisma.task.findMany({
        where: {
          status: { in: [...OPEN_TASK_STATES] },
          dueAt: { lte: today },
          OR: [{ ownerId: userId }, { participants: { some: { id: userId } } }],
        },
        include: {
          file: {
            select: {
              id: true,
              fileNumber: true,
              client: { select: { fullName: true } },
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
        take: 25,
      }),
      prisma.mortgageFile.findMany({
        where: { status: { in: ['ACTIVE', 'BLOCKED'] } },
        include: {
          client: { select: { id: true, fullName: true } },
          owner: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.mortgageFile.groupBy({
        by: ['stage'],
        where: { status: { in: ['ACTIVE', 'BLOCKED'] } },
        _count: { _all: true },
      }),
    ])

    res.json({
      kpis: { activeFiles, blockedFiles, openTasks, overdueTasks, pendingDocs },
      dueToday,
      recentFiles,
      stageBreakdown: stageBreakdown.map((s) => ({ stage: s.stage, count: s._count._all })),
    })
  }),
)

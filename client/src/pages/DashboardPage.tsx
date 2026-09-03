import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'
import { isOverdue, relative, time } from '@/lib/format'
import { labelOf, TASK_STATUS } from '@/lib/labels'
import type { Dashboard } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge, RAILS } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { KpiCard } from '@/components/ui/KpiCard'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'

function PanelHeader({ title, link }: { title: string; link?: { to: string; label: string } }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hair px-6 py-4">
      <h2 className="font-heading text-[20px] font-medium text-ink">{title}</h2>
      {link && (
        <Link
          to={link.to}
          className="text-[14px] font-medium text-steel-700 underline-offset-[3px] hover:underline"
        >
          {link.label}
        </Link>
      )}
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<Dashboard>('/dashboard'),
    refetchOnMount: 'always',
  })

  if (error) {
    return <ErrorState message="לא הצלחנו לטעון את לוח הבקרה." onRetry={() => refetch()} />
  }

  const kpis = data?.kpis

  return (
    <>
      <div className="mb-6">
        <h1 className="font-heading text-[32px] font-bold leading-tight text-ink">דאשבורד</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          {new Date().toLocaleDateString('he-IL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Four metrics — no fifth. */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !kpis ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[116px] rounded-lg" />)
        ) : (
          <>
            <KpiCard
              label="משימות להיום"
              value={kpis.tasksToday}
              spark={[14, 20, 12, 26]}
              tone="busy"
              onClick={() => navigate('/tasks')}
            />
            <KpiCard
              label="חורגות מיעד"
              value={kpis.overdueTasks}
              tone="urgent"
              accent={kpis.overdueTasks > 0}
              chip={kpis.overdueTasks > 0 ? 'דורש טיפול' : 'הכול בזמן'}
              chipTone={kpis.overdueTasks > 0 ? 'urgent' : 'ok'}
              onClick={() => navigate('/tasks?overdue=1')}
            />
            <KpiCard
              label="תיקים פעילים"
              value={kpis.activeFiles}
              spark={[16, 18, 22, 24]}
              tone="busy"
              onClick={() => navigate('/files?status=ACTIVE')}
            />
            <KpiCard
              label="ממתין לבנק"
              value={kpis.waitingOnBank}
              tone="wait"
              chip="ממתין למענה"
              chipTone="wait"
              onClick={() => navigate('/tasks?status=WAITING_BANK')}
            />
          </>
        )}
      </div>

      {/* 60/40 — today's work against what is stuck. */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <PanelHeader title="משימות היום" link={{ to: '/tasks', label: 'כל המשימות' }} />

          {isLoading ? (
            <div className="space-y-4 p-6">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !data?.dueToday.length ? (
            <EmptyState
              icon={<CheckCircle2 className="size-7" />}
              tone="ok"
              title="אין משימות להיום"
              description="כל מה שהיה מתוזמן להיום כבר טופל. אפשר להיכנס לתיק ולהוסיף את הצעד הבא."
              action={<Button onClick={() => navigate('/files')}>לתיקים</Button>}
            />
          ) : (
            <ul>
              {data.dueToday.map((task, i) => {
                const tone = labelOf(TASK_STATUS, task.status).tone
                const overdue = isOverdue(task.dueAt)
                return (
                  <li key={task.id}>
                    <Link
                      to={`/files/${task.fileId}`}
                      className={cn(
                        'flex items-center gap-4 border-s-4 px-6 py-4',
                        'transition-colors duration-micro ease-standard hover:bg-ink/[0.04]',
                        i < data.dueToday.length - 1 && 'border-b border-b-row',
                        RAILS[tone],
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-ink">{task.title}</p>
                        <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                          <span className="numeric" dir="ltr">
                            {task.file?.fileNumber}
                          </span>
                          {task.file?.client.fullName && ` · ${task.file.client.fullName}`}
                          {task.waitingOn && ` · ממתין ל${task.waitingOn}`}
                          {task.dueAt && (
                            <>
                              {' · '}
                              <span className={cn('numeric', overdue && 'text-urgent-ink')} dir="ltr">
                                {overdue ? relative(task.dueAt) : `יעד ${time(task.dueAt)}`}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <Badge tone={overdue ? 'urgent' : tone}>
                        {overdue ? 'חריגה' : labelOf(TASK_STATUS, task.status).label}
                      </Badge>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="flex-1 overflow-hidden">
            <PanelHeader title="תיקים חסומים" />
            {isLoading ? (
              <div className="space-y-3 p-6">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-6" />
                ))}
              </div>
            ) : !data?.blockedFiles.length ? (
              <EmptyState
                icon={<ShieldCheck className="size-7" />}
                tone="ok"
                title="אין תיקים חסומים"
                description="כל התיקים הפעילים זזים."
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-row">
                {data.blockedFiles.map((file) => (
                  <li key={file.id}>
                    <Link
                      to={`/files/${file.id}`}
                      className="flex items-center justify-between gap-3 px-6 py-3.5 transition-colors duration-micro hover:bg-ink/[0.04]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-ink">
                          {file.clientName}
                        </span>
                        <span className="block truncate text-[13px] text-ink-muted">
                          {file.reason || 'ללא סיבה מתועדת'}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'numeric shrink-0 text-[15px] font-semibold',
                          file.daysBlocked >= 5 ? 'text-urgent' : 'text-wait',
                        )}
                        dir="ltr"
                      >
                        {file.daysBlocked}D
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex-1 overflow-hidden">
            <PanelHeader title="יומן פעילות" />
            {isLoading ? (
              <div className="space-y-3 p-6">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-4" />
                ))}
              </div>
            ) : !data?.activity.length ? (
              <p className="px-6 py-8 text-center text-[14px] text-ink-muted">
                עדיין לא נרשמה פעילות במערכת.
              </p>
            ) : (
              <ul className="space-y-3 px-6 py-4">
                {data.activity.map((entry) => (
                  <li key={entry.id} className="flex gap-2.5 text-[13.5px] text-ink-muted">
                    <span className="numeric shrink-0 text-ink-subtle" dir="ltr">
                      {time(entry.createdAt)}
                    </span>
                    <span className="min-w-0 truncate">
                      {entry.action}
                      {entry.actor && ` — ${entry.actor.name}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

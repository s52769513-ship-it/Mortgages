import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  FileText,
  ListChecks,
  MessageSquare,
  Pencil,
  Plus,
  Unlock,
  Upload,
} from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'
import { date, isOverdue, money, percent, relative, time } from '@/lib/format'
import {
  BANK_APP_STATUS,
  DOCUMENT_STATUS,
  FILE_STAGE,
  FILE_STATUS,
  labelOf,
  TASK_STATUS,
  type Stage,
} from '@/lib/labels'
import type { MortgageFile, Task } from '@/types'
import { Badge, RAILS } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FactRow, Tabs, TabPanel } from '@/components/ui/Tabs'
import { CompactStepper, FileStepper } from '@/components/ui/Stepper'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { InternalChat } from '@/components/InternalChat'
import { ActivityFeed } from '@/components/ActivityFeed'
import { BankApplicationModal } from '@/components/BankApplicationModal'
import { BankApplicationRows } from '@/components/BankApplicationRows'
import { NewTaskModal } from '@/components/NewTaskModal'
import { UploadDocumentModal } from '@/components/UploadDocumentModal'
import { CommunicationsTab } from '@/components/CommunicationsTab'
import { ExpensesTab } from '@/components/ExpensesTab'
import { ProfessionalsPanel } from '@/components/ProfessionalsPanel'
import { EditFileModal } from '@/components/EditFileModal'
import { TaskOverlay } from '@/components/TaskOverlay'

const TAB_IDS = [
  'tasks',
  'details',
  'documents',
  'banks',
  'communications',
  'expenses',
  'chat',
  'log',
] as const

export function FileDetailPage() {
  const { id = '' } = useParams()
  const { notify } = useToast()
  const queryClient = useQueryClient()

  // Tasks first: this is a daily work screen, not a record view.
  const [tab, setTab] = useState<(typeof TAB_IDS)[number]>('tasks')
  const [stageFilter, setStageFilter] = useState<Stage | null>(null)
  const [applying, setApplying] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [editingFile, setEditingFile] = useState(false)
  const [addingDocument, setAddingDocument] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const {
    data: file,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['file', id],
    queryFn: () => api.get<MortgageFile>(`/files/${id}`),
  })

  // Clicking a step filters, which is cheap and reversible. Actually moving the
  // file is a real change that lands in the log, so it takes a second,
  // deliberate click rather than happening on the first one.
  const moveStage = useMutation({
    mutationFn: (stage: Stage) => api.patch<MortgageFile>(`/files/${id}`, { stage }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['file', id] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setStageFilter(null)
      notify(`התיק הועבר לשלב ${FILE_STAGE[updated.stage as Stage]?.label ?? updated.stage}`)
    },
    onError: (e: Error) => notify('שינוי השלב נכשל', { tone: 'error', detail: e.message }),
  })

  const unblock = useMutation({
    mutationFn: () => api.patch<MortgageFile>(`/files/${id}`, { status: 'ACTIVE', blockReason: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify('החסימה הוסרה')
    },
    onError: (e: Error) => notify('הסרת החסימה נכשלה', { tone: 'error', detail: e.message }),
  })

  if (error) return <ErrorState message="לא הצלחנו לטעון את התיק." onRetry={() => refetch()} />

  if (isLoading || !file) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    )
  }

  const blocked = file.status === 'BLOCKED'
  const tasks = file.tasks ?? []
  const documents = file.documents ?? []
  const bankApps = file.bankApps ?? []

  const visibleTasks = stageFilter ? tasks.filter((t) => t.stage === stageFilter) : tasks
  const visibleDocs = documents

  return (
    <div className="space-y-6">
      <Card>
        {/* Sticky header: file number, client, status, one primary action. */}
        <div className="sticky top-16 z-20 rounded-t-lg bg-surface">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair px-7 py-4">
          <div className="min-w-0">
            <p className="eyebrow text-[12px] text-steel-600" dir="ltr">
              File {file.fileNumber}
              {file.dealType && <span className="normal-case"> · {file.dealType}</span>}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-4">
              <Link
                to={`/clients/${file.clientId}`}
                className="font-heading text-[28px] font-bold leading-tight text-ink underline-offset-4 hover:underline"
              >
                {file.client?.fullName}
              </Link>
              <Badge tone={labelOf(FILE_STATUS, file.status).tone}>
                {labelOf(FILE_STATUS, file.status).label}
              </Badge>
              <Badge tone={labelOf(FILE_STAGE, file.stage).tone}>
                {labelOf(FILE_STAGE, file.stage).label}
              </Badge>
              {file.owner && (
                <span className="text-[14px] text-ink-muted">אחראי: {file.owner.name}</span>
              )}
            </div>

            {/* Key facts row — the information most often needed at a glance. */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-muted">
              {file.requestedAmount && (
                <span className="flex items-center gap-1.5">
                  <span className="text-ink-subtle">סכום מבוקש</span>
                  <span className="numeric font-medium text-ink" dir="ltr">
                    {money(file.requestedAmount)}
                  </span>
                </span>
              )}
              {file.executionDeadline && (
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" />
                  <span className="text-ink-subtle">מועד אחרון</span>
                  <span className="numeric font-medium text-ink" dir="ltr">
                    {date(file.executionDeadline)}
                  </span>
                </span>
              )}
              {file.nextAction && (
                <span className="flex items-center gap-1.5">
                  <span className="text-ink-subtle">הצעד הבא</span>
                  <span className="font-medium text-ink">{file.nextAction}</span>
                  {file.nextActionDate && (
                    <span className="numeric text-ink-subtle" dir="ltr">
                      ({date(file.nextActionDate)})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setAddingTask(true)}>
              <Plus className="size-4" />
              משימה
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAddingDocument(true)}>
              <Upload className="size-4" />
              מסמך
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditingFile(true)}>
              <Pencil className="size-4" />
              ערוך
            </Button>
            <Button size="sm" onClick={() => setApplying(true)}>
              <Building2 className="size-4" />
              בקשה לבנק
            </Button>
            </div>
          </div>

          {blocked && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair bg-urgent-tint px-7 py-3">
              <p className="text-[14px] font-medium text-urgent-ink">
                התיק חסום{file.blockReason ? ` — ${file.blockReason}` : ''}
              </p>
              <Button
                size="sm"
                variant="secondary"
                loading={unblock.isPending}
                loadingLabel="מסיר…"
                onClick={() => unblock.mutate()}
              >
                <Unlock className="size-4" />
                הסר חסימה
              </Button>
            </div>
          )}
        </div>

        {/* The stepper doubles as navigation: a step filters the lists below. */}
        <div className="border-b border-hair px-7 py-4">
          <div className="hidden md:block">
            <FileStepper
              current={file.stage}
              blocked={blocked}
              blockReason={file.blockReason}
              selected={stageFilter}
              onSelect={setStageFilter}
            />
          </div>
          <div className="md:hidden">
            <CompactStepper current={file.stage} />
          </div>
          {stageFilter && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-muted">
              <span>
                מסונן לשלב{' '}
                <strong className="font-semibold">{FILE_STAGE[stageFilter].label}</strong>
              </span>

              {stageFilter !== file.stage && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={moveStage.isPending}
                  loadingLabel="מעביר…"
                  onClick={() => moveStage.mutate(stageFilter)}
                >
                  <ArrowLeft className="size-4" />
                  העבר את התיק לשלב זה
                </Button>
              )}

              <button
                onClick={() => setStageFilter(null)}
                className="font-medium text-steel-700 underline underline-offset-[3px]"
              >
                הצג את כל השלבים
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 overflow-hidden rounded-b-lg xl:grid-cols-[1fr_340px]">
          <div className="min-w-0 xl:border-e xl:border-hair">
            <Tabs
              tabs={[
                { id: 'tasks', label: 'משימות', count: visibleTasks.length },
                { id: 'details', label: 'פרטים' },
                { id: 'documents', label: 'מסמכים', count: documents.length },
                { id: 'banks', label: 'בנקים', count: bankApps.length },
                { id: 'communications', label: 'תקשורת' },
                { id: 'expenses', label: 'הוצאות' },
                { id: 'chat', label: 'צ׳אט פנימי' },
                { id: 'log', label: 'יומן' },
              ]}
              active={tab}
              onChange={(id) => setTab(id as (typeof TAB_IDS)[number])}
            />

            <TabPanel when="tasks" active={tab}>
              {!visibleTasks.length ? (
                <EmptyState
                  icon={<ListChecks className="size-7" />}
                  title={stageFilter ? 'אין משימות בשלב הזה' : 'התיק עדיין ללא משימות'}
                  description={
                    stageFilter
                      ? 'אף משימה לא משויכת לשלב שנבחר. אפשר להציג את כל השלבים.'
                      : 'משימה מגדירה מי עושה מה ועד מתי — היא מה שמזיז את התיק קדימה.'
                  }
                  action={
                    <Button onClick={() => setAddingTask(true)}>
                      <Plus className="size-4" />
                      משימה חדשה
                    </Button>
                  }
                />
              ) : (
                <ul>
                  {visibleTasks.map((task, i) => {
                    const tone = labelOf(TASK_STATUS, task.status).tone
                    const overdue = isOverdue(task.dueAt) && task.status !== 'COMPLETED'
                    return (
                      <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => setEditingTask(task)}
                        className={cn(
                          'flex w-full items-center gap-4 border-s-4 px-7 py-3.5 text-right',
                          'transition-colors duration-micro ease-standard hover:bg-ink/[0.04]',
                          i < visibleTasks.length - 1 && 'border-b border-b-row',
                          RAILS[tone],
                        )}
                      >
                        <span
                          className="numeric w-6 shrink-0 text-[13px] text-ink-subtle"
                          dir="ltr"
                        >
                          {task.seq}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-ink">{task.title}</p>
                          <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                            {task.owner?.name ?? 'ללא אחראי'}
                            {task.waitingOn && ` · ממתין ל${task.waitingOn}`}
                            {task.completedAt
                              ? ` · הושלמה ${date(task.completedAt)}`
                              : task.dueAt
                                ? ` · יעד ${date(task.dueAt)} ${time(task.dueAt)}`
                                : ''}
                          </p>
                        </div>
                        <Badge tone={overdue ? 'urgent' : tone}>
                          {overdue ? 'חריגה' : labelOf(TASK_STATUS, task.status).label}
                        </Badge>
                      </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </TabPanel>

            <TabPanel when="details" active={tab} className="px-7 py-5">
              <div className="grid gap-8 md:grid-cols-2">
                <section>
                  <h3 className="eyebrow mb-3 text-[12px] text-ink-muted" dir="ltr">
                    Property
                  </h3>
                  <dl className="divide-y divide-row">
                    <FactRow label="סוג עסקה" value={file.dealType} />
                    <FactRow label="סוג הנכס" value={file.propertyType} />
                    <FactRow label="כתובת" value={file.propertyAddress} />
                    <FactRow
                      label="מחיר רכישה"
                      value={<span className="numeric" dir="ltr">{money(file.purchasePrice)}</span>}
                    />
                    <FactRow
                      label="שווי הנכס"
                      value={<span className="numeric" dir="ltr">{money(file.propertyValue)}</span>}
                    />
                  </dl>
                </section>

                <section>
                  <h3 className="eyebrow mb-3 text-[12px] text-ink-muted" dir="ltr">
                    Financing
                  </h3>
                  <dl className="divide-y divide-row">
                    <FactRow
                      label="הון עצמי"
                      value={<span className="numeric" dir="ltr">{money(file.equity)}</span>}
                    />
                    <FactRow
                      label="החזר חודשי רצוי"
                      value={<span className="numeric" dir="ltr">{money(file.desiredMonthly)}</span>}
                    />
                    <FactRow
                      label="הכנסות הלווים"
                      value={<span className="numeric" dir="ltr">{money(file.borrowersIncome)}</span>}
                    />
                    <FactRow label="התחייבויות קיימות" value={file.existingLiabilities} />
                    <FactRow
                      label="מועד אחרון לביצוע"
                      value={<span className="numeric" dir="ltr">{date(file.executionDeadline)}</span>}
                    />
                  </dl>
                </section>
              </div>
            </TabPanel>

            <TabPanel when="documents" active={tab}>
              {!visibleDocs.length ? (
                <EmptyState
                  icon={<FileText className="size-7" />}
                  title="התיק עדיין ריק ממסמכים"
                  description="בלי מסמכים אי אפשר להגיש לבנק. אפשר להעלות מסמך או לבקש אותו מהלקוח."
                  action={
                    <Button onClick={() => setAddingDocument(true)}>
                      <Upload className="size-4" />
                      העלה מסמך
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="flex justify-end border-b border-hair px-7 py-3">
                    <Button size="sm" variant="secondary" onClick={() => setAddingDocument(true)}>
                      <Upload className="size-4" />
                      העלה מסמך
                    </Button>
                  </div>
                <div className="grid gap-px bg-hair sm:grid-cols-2">
                  {visibleDocs.map((doc) => {
                    const tone = labelOf(DOCUMENT_STATUS, doc.status).tone
                    return (
                      <article
                        key={doc.id}
                        className={cn(
                          'flex flex-col gap-2.5 border-t-4 bg-surface px-6 py-5',
                          RAILS[tone],
                        )}
                      >
                        <h4 className="flex items-baseline gap-2 text-[15px] font-medium text-ink">
                          <span className="numeric text-[13px] text-ink-subtle" dir="ltr">
                            {doc.seq}
                          </span>
                          <span className="min-w-0 truncate">{doc.docType}</span>
                        </h4>
                        <p className="text-[13px] text-ink-muted">
                          גרסה <span className="numeric" dir="ltr">{doc.version}</span>
                          {doc.issueNotes
                            ? ` · ${doc.issueNotes}`
                            : doc.receivedAt
                              ? ` · התקבל ${date(doc.receivedAt)}`
                              : ''}
                        </p>
                        <div className="flex items-center justify-between gap-3">
                          <Badge tone={tone}>{labelOf(DOCUMENT_STATUS, doc.status).label}</Badge>
                          {doc.storagePath && (
                            <a
                              href={`/api/documents/${doc.id}/file`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[13px] font-medium text-steel-700 underline-offset-[3px] hover:underline"
                            >
                              פתח קובץ
                            </a>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
                </>
              )}
            </TabPanel>

            <TabPanel when="banks" active={tab}>
              {!bankApps.length ? (
                <EmptyState
                  icon={<Building2 className="size-7" />}
                  title="עוד לא הוגשה בקשה לבנק"
                  description="לכל בנק נפתחת בקשה נפרדת, כך שאפשר להשוות הצעות זו מול זו."
                  action={<Button onClick={() => setApplying(true)}>בקשה חדשה לבנק</Button>}
                />
              ) : (
                <>
                  <div className="flex justify-end border-b border-hair px-7 py-3">
                    <Button size="sm" variant="secondary" onClick={() => setApplying(true)}>
                      <Plus className="size-4" />
                      בקשה נוספת
                    </Button>
                  </div>
                  <BankApplicationRows applications={bankApps} fileId={file.id} />
                </>
              )}
            </TabPanel>

            <TabPanel when="communications" active={tab}>
              <CommunicationsTab fileId={file.id} />
            </TabPanel>

            <TabPanel when="expenses" active={tab}>
              <ExpensesTab file={file} />
            </TabPanel>

            <TabPanel when="chat" active={tab}>
              <InternalChat entityType="MORTGAGE_FILE" entityId={file.id} className="h-[560px]" />
            </TabPanel>

            <TabPanel when="log" active={tab}>
              <ActivityFeed entityType="MORTGAGE_FILE" entityId={file.id} />
            </TabPanel>
          </div>

          {/* Side rail — the answer to "where does this file stand" without scrolling. */}
          <aside className="flex flex-col gap-4 px-6 py-5">
            <section>
              <h3 className="eyebrow mb-2 text-[12px] text-ink-muted" dir="ltr">
                File facts
              </h3>
              <dl>
                <FactRow
                  label="מחיר רכישה"
                  value={<span className="numeric" dir="ltr">{money(file.purchasePrice)}</span>}
                />
                <FactRow
                  label="סכום משכנתא"
                  value={<span className="numeric" dir="ltr">{money(file.requestedAmount)}</span>}
                />
                <FactRow
                  label="אחוז מימון"
                  value={<span className="numeric" dir="ltr">{percent(file.ltvPercent)}</span>}
                />
                <FactRow
                  label="הון עצמי"
                  value={<span className="numeric" dir="ltr">{money(file.equity)}</span>}
                />
              </dl>
            </section>

            <section className="border-t border-hair pt-3">
              <dl>
                <FactRow label="אחראי מוביל" value={file.owner?.name} />
                <FactRow label="בנק יעד" value={file.targetBank?.name} />
              </dl>
            </section>

            <ProfessionalsPanel fileId={file.id} professionals={file.professionals ?? []} />

            {file.nextAction && (
              <section className="mt-auto border border-steel-600 bg-busy-tint px-4 py-3">
                <p className="eyebrow text-[12px] text-steel-700" dir="ltr">
                  Next action
                </p>
                <p className="mt-1 text-[14px] font-medium leading-snug text-steel-800">
                  {file.nextAction}
                </p>
                {file.nextActionDate && (
                  <p className="numeric mt-1.5 text-[13px] text-steel-700" dir="ltr">
                    {isOverdue(file.nextActionDate)
                      ? `באיחור · ${relative(file.nextActionDate)}`
                      : `יעד ${date(file.nextActionDate)}`}
                  </p>
                )}
              </section>
            )}
          </aside>
        </div>
      </Card>

      <BankApplicationModal
        fileId={file.id}
        open={applying}
        onClose={() => setApplying(false)}
      />

      {addingTask && (
        <NewTaskModal
          fileId={file.id}
          fileNumber={file.fileNumber}
          defaultStage={stageFilter ?? file.stage}
          open
          onClose={() => setAddingTask(false)}
        />
      )}

      {editingFile && <EditFileModal file={file} open onClose={() => setEditingFile(false)} />}

      {addingDocument && (
        <UploadDocumentModal fileId={file.id} open onClose={() => setAddingDocument(false)} />
      )}

      <TaskOverlay
        task={editingTask}
        open={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
      />
    </div>
  )
}

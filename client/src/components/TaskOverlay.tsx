import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'
import { date, dateTime } from '@/lib/format'
import {
  isWaitingStatus,
  labelOf,
  options,
  TASK_PRIORITY,
  TASK_STATUS,
} from '@/lib/labels'
import type { Employee, Task } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, SegmentedControl, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

/** <input type="datetime-local"> wants a local-time string, not an ISO stamp. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const TONE_PILL = {
  neutral: 'border-field text-ink-muted',
  busy: 'border-busy bg-busy-tint text-busy-ink',
  ok: 'border-ok bg-ok-tint text-ok-ink',
  wait: 'border-wait bg-wait-tint text-wait-ink',
  urgent: 'border-urgent bg-urgent-tint text-urgent-ink',
} as const

const daysSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))

/**
 * Task editor, opened over whatever list or file page you came from.
 * Fields appear as the chosen status makes them relevant, rather than
 * showing every field at once.
 */
export function TaskOverlay({
  task,
  open,
  onClose,
}: {
  task: Task | null
  open: boolean
  onClose: () => void
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    status: 'OPEN',
    waitingOn: '',
    ownerId: '',
    dueAt: '',
    priority: 'NORMAL',
    description: '',
    result: '',
    completionNote: '',
  })

  useEffect(() => {
    if (!task) return
    setForm({
      status: task.status,
      waitingOn: task.waitingOn ?? '',
      ownerId: task.ownerId ?? '',
      dueAt: toLocalInput(task.dueAt),
      priority: task.priority,
      description: task.description ?? '',
      result: task.result ?? '',
      completionNote: task.completionNote ?? '',
    })
  }, [task])

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees'),
    enabled: open,
  })

  const save = useMutation({
    mutationFn: () =>
      api.patch<Task>(`/tasks/${task!.id}`, {
        status: form.status,
        waitingOn: form.waitingOn || null,
        ownerId: form.ownerId || null,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        priority: form.priority,
        description: form.description || null,
        result: form.result || null,
        completionNote: form.completionNote || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['file'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify('המשימה נשמרה')
      onClose()
    },
    onError: (e: Error) => notify('שמירת המשימה נכשלה', { tone: 'error', detail: e.message }),
  })

  if (!task) return null

  const waiting = isWaitingStatus(form.status)
  const completed = form.status === 'COMPLETED'
  const tone = labelOf(TASK_STATUS, form.status).tone
  const missingWaitingOn = waiting && !form.waitingOn.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={task.file ? `Task · File ${task.file.fileNumber}` : 'Task'}
      title={task.title}
      size="lg"
      footer={
        <>
          <span className="me-auto text-[13px] text-ink-subtle">
            {task.createdBy
              ? `נוצרה על ידי ${task.createdBy.name} · ${date(task.createdAt)}`
              : `נוצרה ${date(task.createdAt)}`}
          </span>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button
            loading={save.isPending}
            disabled={missingWaitingOn}
            onClick={() => save.mutate()}
          >
            שמור
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="task-status" className="block text-[12px] font-semibold text-ink-muted">
              סטטוס
            </label>
            <select
              id="task-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className={cn(
                'h-11 w-full cursor-pointer rounded-full border px-4 text-[14px] font-semibold md:h-10',
                'transition-colors duration-micro ease-standard',
                TONE_PILL[tone],
              )}
            >
              {options(TASK_STATUS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {waiting && (
            <div className="animate-fade-in">
              <Input
                label="גורם שממתינים לו"
                required
                value={form.waitingOn}
                onChange={(e) => setForm({ ...form, waitingOn: e.target.value })}
                error={missingWaitingOn ? 'סטטוס המתנה מחייב לציין למי ממתינים' : undefined}
                hint={
                  !missingWaitingOn && task.status === form.status && task.waitingOn
                    ? `ממתין ${daysSince(task.createdAt)} ימים`
                    : undefined
                }
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="task-owner" className="block text-[12px] font-semibold text-ink-muted">
              אחראי מוביל
            </label>
            <select
              id="task-owner"
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              className={cn(
                'h-11 w-full cursor-pointer rounded-md border border-field bg-surface px-3 text-[15px] md:h-10',
                'transition-colors duration-micro ease-standard focus:border-steel-600',
              )}
            >
              <option value="">ללא אחראי</option>
              {(employees ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="תאריך ושעת יעד"
            type="datetime-local"
            dir="ltr"
            disabled={completed}
            hint={completed ? 'שדות היעד ננעלים כשהמשימה הושלמה' : undefined}
            value={form.dueAt}
            onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
          />

          <SegmentedControl
            label="עדיפות"
            value={form.priority}
            onChange={(v) => setForm({ ...form, priority: v })}
            options={options(TASK_PRIORITY)}
          />
        </div>

        <Textarea
          label="תיאור המשימה"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        {completed && (
          <div className="animate-fade-in space-y-5 border-t border-hair pt-5">
            <Textarea
              label="תוצאת ביצוע"
              rows={2}
              value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value })}
            />
            <Textarea
              label="הערת סיום"
              rows={2}
              value={form.completionNote}
              onChange={(e) => setForm({ ...form, completionNote: e.target.value })}
            />
            {task.completedAt && (
              <p className="text-[13px] text-ink-subtle">
                הושלמה ב־{dateTime(task.completedAt)}
              </p>
            )}
          </div>
        )}

        {task.escalationRule && (
          <p className="rounded-md bg-wait-tint px-3 py-2 text-[13px] text-wait-ink">
            כלל הסלמה: {task.escalationRule}
          </p>
        )}
      </div>
    </Modal>
  )
}

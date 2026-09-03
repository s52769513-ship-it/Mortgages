import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import {
  FILE_STAGE,
  isWaitingStatus,
  options,
  TASK_PRIORITY,
  TASK_STATUS,
} from '@/lib/labels'
import type { Employee, Task } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, SegmentedControl, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

const BLANK = {
  title: '',
  stage: '',
  ownerId: '',
  dueAt: '',
  priority: 'NORMAL',
  status: 'OPEN',
  waitingOn: '',
  description: '',
}

export function NewTaskModal({
  fileId,
  fileNumber,
  defaultStage,
  open,
  onClose,
}: {
  fileId: string
  fileNumber?: string
  defaultStage?: string | null
  open: boolean
  onClose: () => void
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ ...BLANK, stage: defaultStage ?? '' })
  const [touched, setTouched] = useState(false)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees'),
    enabled: open,
  })

  const create = useMutation({
    mutationFn: () =>
      api.post<Task>('/tasks', {
        fileId,
        title: form.title.trim(),
        stage: form.stage || null,
        ownerId: form.ownerId || null,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        priority: form.priority,
        status: form.status,
        waitingOn: form.waitingOn.trim() || null,
        description: form.description.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify('המשימה נוצרה')
      setForm({ ...BLANK, stage: defaultStage ?? '' })
      setTouched(false)
      onClose()
    },
    onError: (e: Error) => notify('יצירת המשימה נכשלה', { tone: 'error', detail: e.message }),
  })

  const waiting = isWaitingStatus(form.status)
  const missingTitle = form.title.trim().length < 2
  const missingWaitingOn = waiting && !form.waitingOn.trim()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (missingTitle || missingWaitingOn) return
    create.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={fileNumber ? `Task · File ${fileNumber}` : undefined}
      title="משימה חדשה"
      description="משימה מגדירה מי עושה מה ועד מתי — היא מה שמזיז את התיק קדימה."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="new-task" type="submit" loading={create.isPending}>
            צור משימה
          </Button>
        </>
      }
    >
      <form id="new-task" onSubmit={submit} className="space-y-5">
        <Input
          label="שם המשימה"
          required
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          error={touched && missingTitle ? 'נדרש שם משימה' : undefined}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="שלב בתהליך"
            placeholder="ללא שיוך לשלב"
            options={options(FILE_STAGE)}
            value={form.stage}
            onChange={(e) => set('stage', e.target.value)}
          />

          <Select
            label="אחראי מוביל"
            placeholder="ללא אחראי"
            options={(employees ?? []).map((e) => ({ value: e.id, label: e.name }))}
            value={form.ownerId}
            onChange={(e) => set('ownerId', e.target.value)}
          />

          <Select
            label="סטטוס"
            options={options(TASK_STATUS)}
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
          />

          {waiting && (
            <div className="animate-fade-in">
              <Input
                label="גורם שממתינים לו"
                required
                value={form.waitingOn}
                onChange={(e) => set('waitingOn', e.target.value)}
                error={
                  touched && missingWaitingOn ? 'סטטוס המתנה מחייב לציין למי ממתינים' : undefined
                }
              />
            </div>
          )}

          <Input
            label="תאריך ושעת יעד"
            type="datetime-local"
            dir="ltr"
            value={form.dueAt}
            onChange={(e) => set('dueAt', e.target.value)}
          />

          <SegmentedControl
            label="עדיפות"
            value={form.priority}
            onChange={(v) => set('priority', v)}
            options={options(TASK_PRIORITY)}
          />
        </div>

        <Textarea
          label="תיאור המשימה"
          rows={3}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </form>
    </Modal>
  )
}

import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, FileText, MessageSquare, Paperclip, Plus, X } from 'lucide-react'
import { api, qs } from '@/api/client'
import { cn } from '@/lib/cn'
import { dateTime } from '@/lib/format'
import { COMMUNICATION_TYPE, labelOf, options } from '@/lib/labels'
import type { Communication } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, SegmentedControl, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'

const BLANK = {
  type: 'PHONE',
  direction: 'OUT' as 'IN' | 'OUT',
  occurredAt: '',
  sender: '',
  recipient: '',
  subject: '',
  summary: '',
  body: '',
}

const toLocalInput = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function LogModal({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ ...BLANK, occurredAt: toLocalInput() })
  const [file, setFile] = useState<File | null>(null)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const create = useMutation({
    mutationFn: () => {
      const body = new FormData()
      body.append('fileId', fileId)
      body.append('type', form.type)
      body.append('direction', form.direction)
      if (form.occurredAt) body.append('occurredAt', new Date(form.occurredAt).toISOString())
      for (const key of ['sender', 'recipient', 'subject', 'summary', 'body'] as const) {
        if (form[key].trim()) body.append(key, form[key].trim())
      }
      if (file) body.append('file', file, file.name)
      return api.upload<Communication>('/communications', body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications', fileId] })
      queryClient.invalidateQueries({ queryKey: ['file', fileId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify('התקשורת נרשמה')
      onClose()
    },
    onError: (e: Error) => notify('הרישום נכשל', { tone: 'error', detail: e.message }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="רישום תקשורת"
      description="שיחה, מייל או פגישה — נשמר בתיק כדי שאפשר יהיה לחזור אליו."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="log-communication" type="submit" loading={create.isPending}>
            שמור
          </Button>
        </>
      }
    >
      <form id="log-communication" onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="סוג התקשורת"
            options={options(COMMUNICATION_TYPE)}
            value={form.type}
            onChange={(e) => set('type', e.target.value)}
          />
          <SegmentedControl
            label="כיוון"
            value={form.direction}
            onChange={(v) => set('direction', v)}
            options={[
              { value: 'OUT', label: 'יוצא' },
              { value: 'IN', label: 'נכנס' },
            ]}
          />
          <Input
            label="שולח"
            value={form.sender}
            onChange={(e) => set('sender', e.target.value)}
          />
          <Input
            label="נמען"
            value={form.recipient}
            onChange={(e) => set('recipient', e.target.value)}
          />
          <Input
            label="תאריך ושעה"
            type="datetime-local"
            dir="ltr"
            value={form.occurredAt}
            onChange={(e) => set('occurredAt', e.target.value)}
          />
          <Input
            label="נושא"
            value={form.subject}
            onChange={(e) => set('subject', e.target.value)}
          />
        </div>

        <Textarea
          label="סיכום"
          rows={2}
          hint="השורה שתופיע ברשימה"
          value={form.summary}
          onChange={(e) => set('summary', e.target.value)}
        />
        <Textarea
          label="תוכן מלא"
          rows={4}
          value={form.body}
          onChange={(e) => set('body', e.target.value)}
        />

        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-ink-muted">
            קובץ מצורף
          </span>
          {file ? (
            <div className="flex items-center gap-2.5 rounded-md border border-field bg-surface px-3 py-2.5">
              <FileText className="size-4 shrink-0 text-ink-subtle" />
              <span className="min-w-0 flex-1 truncate text-[14px]">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} aria-label="הסרת הקובץ">
                <X className="size-4 text-ink-subtle hover:text-ink" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-field',
                'px-3 py-4 text-[14px] text-ink-muted',
                'transition-colors duration-micro ease-standard hover:border-steel-600 hover:text-ink',
              )}
            >
              <Paperclip className="size-4" />
              צרף קובץ
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          <p className="mt-1.5 text-[12px] text-ink-subtle">
            קובץ שיצורף כאן ייכנס גם לרשימת המסמכים של התיק.
          </p>
        </div>
      </form>
    </Modal>
  )
}

export function CommunicationsTab({ fileId }: { fileId: string }) {
  const [logging, setLogging] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['communications', fileId],
    queryFn: () =>
      api.get<{ items: Communication[]; total: number }>(`/communications${qs({ fileId })}`),
  })

  if (error) return <ErrorState message="לא הצלחנו לטעון את התקשורת." onRetry={() => refetch()} />

  return (
    <>
      <div className="flex justify-end border-b border-hair px-7 py-3">
        <Button size="sm" variant="secondary" onClick={() => setLogging(true)}>
          <Plus className="size-4" />
          רישום תקשורת
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-7">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<MessageSquare className="size-7" />}
          title="עוד לא נרשמה תקשורת"
          description="כל שיחה, מייל ופגישה נשמרים כאן, כך שאפשר לחזור ולראות מה סוכם ומתי."
          action={<Button onClick={() => setLogging(true)}>רשום תקשורת</Button>}
        />
      ) : (
        <ul className="divide-y divide-row">
          {data.items.map((c) => (
            <li key={c.id} className="px-7 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full',
                        c.direction === 'IN' ? 'bg-ok-tint text-ok' : 'bg-busy-tint text-busy',
                      )}
                      title={c.direction === 'IN' ? 'נכנס' : 'יוצא'}
                    >
                      {c.direction === 'IN' ? (
                        <ArrowDownLeft className="size-3.5" />
                      ) : (
                        <ArrowUpRight className="size-3.5" />
                      )}
                    </span>
                    <span className="text-[15px] font-medium text-ink">
                      {c.subject || labelOf(COMMUNICATION_TYPE, c.type).label}
                    </span>
                    <Badge tone="neutral">{labelOf(COMMUNICATION_TYPE, c.type).label}</Badge>
                  </div>

                  <p className="mt-1 text-[13px] text-ink-muted">
                    {[c.sender, c.recipient].filter(Boolean).join(' ← ') || 'ללא צדדים מתועדים'}
                    {c.author && ` · נרשם על ידי ${c.author.name}`}
                  </p>

                  {c.summary && (
                    <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{c.summary}</p>
                  )}

                  {c.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={`/api/documents/${a.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-md bg-surface-raised px-2.5 py-1 text-[12.5px] text-ink-muted transition-colors duration-micro hover:text-ink"
                        >
                          <FileText className="size-3.5" />
                          {a.fileName || a.docType}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <time className="numeric shrink-0 text-[13px] text-ink-subtle" dir="ltr">
                  {dateTime(c.occurredAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}

      {logging && <LogModal fileId={fileId} onClose={() => setLogging(false)} />}
    </>
  )
}

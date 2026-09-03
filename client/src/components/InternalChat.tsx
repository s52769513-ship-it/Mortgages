import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AtSign, Check, FileText, Mic, Paperclip, Send, Square, Trash2, X } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { dateTime, initials, relative } from '@/lib/format'
import type { Attachment, Comment, Employee } from '@/types'
import { Button } from '@/components/ui/Button'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'

export type ChatEntity =
  | 'CLIENT'
  | 'MORTGAGE_FILE'
  | 'TASK'
  | 'DOCUMENT'
  | 'BANK_APPLICATION'
  | 'EMPLOYEE'

const POLL_MS = 5000

const formatDuration = (ms: number | null) => {
  if (!ms) return ''
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`

function AttachmentView({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const url = `/api/comments/attachments/${attachment.id}/file`

  if (attachment.kind === 'VOICE') {
    return (
      <div className="mt-2 space-y-1">
        <audio controls src={url} className="h-9 w-full max-w-[240px]" />
        {attachment.durationMs && (
          <span className={cn('numeric text-[11.5px]', mine ? 'text-white/70' : 'text-ink-subtle')}>
            {formatDuration(attachment.durationMs)}
          </span>
        )}
      </div>
    )
  }

  if (attachment.mimeType.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
        <img
          src={url}
          alt={attachment.fileName}
          className="max-h-56 rounded-md border border-hair object-contain"
        />
      </a>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'mt-2 flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px]',
        'transition-colors duration-micro ease-standard',
        mine ? 'bg-white/15 hover:bg-white/25' : 'bg-surface-raised hover:bg-ink/[0.06]',
      )}
    >
      <FileText className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
      <span className={cn('numeric shrink-0', mine ? 'text-white/70' : 'text-ink-subtle')} dir="ltr">
        {formatSize(attachment.sizeBytes)}
      </span>
    </a>
  )
}

/** Picks colleagues to notify about this message. */
function MentionPicker({
  selected,
  onToggle,
  onClose,
}: {
  selected: string[]
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees'),
  })

  return (
    <div className="absolute bottom-full z-20 mb-2 w-60 overflow-hidden rounded-lg border border-hair bg-surface shadow-modal">
      <div className="flex items-center justify-between border-b border-hair px-3 py-2">
        <span className="text-[12px] font-semibold text-ink-muted">מי צריך לדעת?</span>
        <button onClick={onClose} aria-label="סגירה" className="text-ink-subtle hover:text-ink">
          <X className="size-3.5" />
        </button>
      </div>
      <ul className="max-h-56 overflow-y-auto py-1">
        {(employees ?? []).map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onToggle(e.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-right text-[14px] transition-colors duration-micro hover:bg-ink/[0.04]"
            >
              <span className="min-w-0 flex-1 truncate">{e.name}</span>
              {selected.includes(e.id) && <Check className="size-4 shrink-0 text-steel-600" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The team's thread on one record. Own messages sit on the opposite edge from
 * everyone else's, and the thread polls so a colleague's message arrives
 * without reloading the page.
 */
export function InternalChat({
  entityType,
  entityId,
  className,
}: {
  entityType: ChatEntity
  entityId: string
  className?: string
}) {
  const { user } = useAuth()
  const { notify } = useToast()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const [picking, setPicking] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const endRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)

  const key = ['comments', entityType, entityId]
  const path = `/comments/${entityType}/${entityId}`

  const { data: comments, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<Comment[]>(path),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [comments?.length])

  // Ticks the label while recording so it is obvious something is happening.
  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200)
    return () => clearInterval(timer)
  }, [recording])

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees'),
  })

  const send = useMutation({
    mutationFn: (payload: { body: string; file?: File; kind?: 'VOICE'; durationMs?: number }) => {
      const form = new FormData()
      form.append('body', payload.body)
      if (mentions.length) form.append('mentions', JSON.stringify(mentions))
      if (payload.file) form.append('file', payload.file, payload.file.name)
      if (payload.kind) form.append('kind', payload.kind)
      if (payload.durationMs) form.append('durationMs', String(payload.durationMs))
      return api.upload<Comment>(path, form)
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Comment[]>(key, (prev) => [...(prev ?? []), created])
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setDraft('')
      setMentions([])
      setPendingFile(null)
    },
    onError: (e: Error) => notify('שליחת ההודעה נכשלה', { tone: 'error', detail: e.message }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/comments/${id}`),
    onSuccess: (_r, id) => {
      queryClient.setQueryData<Comment[]>(key, (prev) => prev?.filter((c) => c.id !== id) ?? [])
      notify('ההודעה נמחקה')
    },
    onError: (e: Error) => notify('מחיקת ההודעה נכשלה', { tone: 'error', detail: e.message }),
  })

  const submit = () => {
    const body = draft.trim()
    if (!body && !pendingFile) return
    send.mutate({ body, file: pendingFile ?? undefined })
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      startedAtRef.current = Date.now()

      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
      recorder.onstop = () => {
        const durationMs = Date.now() - startedAtRef.current
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())

        // Too short to be anything but a misclick.
        if (durationMs < 700) return

        const extension = (recorder.mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm'
        send.mutate({
          body: draft.trim(),
          file: new File([blob], `voice-${Date.now()}.${extension}`, { type: blob.type }),
          kind: 'VOICE',
          durationMs,
        })
      }

      recorder.start()
      recorderRef.current = recorder
      setElapsed(0)
      setRecording(true)
    } catch {
      notify('אין גישה למיקרופון', {
        tone: 'error',
        detail: 'צריך לאשר לדפדפן להשתמש במיקרופון כדי להקליט.',
      })
    }
  }

  const stopRecording = (discard = false) => {
    const recorder = recorderRef.current
    if (!recorder) return
    if (discard) startedAtRef.current = Date.now() // makes onstop treat it as too short
    recorder.stop()
    recorderRef.current = null
    setRecording(false)
  }

  const nameOf = (id: string) => employees?.find((e) => e.id === id)?.name ?? ''

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn('flex gap-3', i === 1 && 'flex-row-reverse')}>
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <Skeleton className="h-12 w-2/3 rounded-lg" />
              </div>
            ))}
          </div>
        ) : !comments?.length ? (
          <EmptyState
            icon={<Send className="size-6" />}
            title="אין עדיין הודעות"
            description="זה המקום לדיון הפנימי של הצוות על הרשומה הזו."
            className="py-10"
          />
        ) : (
          comments.map((c) => {
            const mine = c.author.id === user?.id
            return (
              <div
                key={c.id}
                className={cn('group flex items-end gap-2', mine ? 'flex-row-reverse' : 'flex-row')}
              >
                {!mine && (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[12px] font-semibold text-ink-muted">
                    {initials(c.author.name)}
                  </span>
                )}

                <div className={cn('max-w-[78%] min-w-0', mine && 'items-end')}>
                  {!mine && (
                    <span className="mb-0.5 block text-[12px] font-semibold text-ink-muted">
                      {c.author.name}
                    </span>
                  )}

                  <div
                    className={cn(
                      'rounded-lg px-3 py-2',
                      mine
                        ? 'rounded-br-sm bg-steel-600 text-white'
                        : 'rounded-bl-sm bg-surface-raised text-ink',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed">
                      {c.body}
                    </p>

                    {c.attachments.map((a) => (
                      <AttachmentView key={a.id} attachment={a} mine={mine} />
                    ))}

                    {c.mentions.length > 0 && (
                      <p
                        className={cn(
                          'mt-1.5 text-[11.5px]',
                          mine ? 'text-white/75' : 'text-ink-subtle',
                        )}
                      >
                        נשלח אל {c.mentions.map((m) => m.name).join(', ')}
                      </p>
                    )}
                  </div>

                  <div
                    className={cn(
                      'mt-0.5 flex items-center gap-2',
                      mine ? 'flex-row-reverse' : 'flex-row',
                    )}
                  >
                    <time className="text-[11.5px] text-ink-subtle" title={dateTime(c.createdAt)}>
                      {relative(c.createdAt)}
                    </time>
                    {c.editedAt && <span className="text-[11.5px] text-ink-subtle">(נערך)</span>}
                    {mine && (
                      <button
                        onClick={() => remove.mutate(c.id)}
                        aria-label="מחיקת הודעה"
                        className={cn(
                          'rounded p-0.5 text-ink-subtle opacity-0 transition-all duration-micro',
                          'hover:text-urgent group-hover:opacity-100 focus-visible:opacity-100',
                        )}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="relative border-t border-hair bg-paper p-3">
        {picking && (
          <MentionPicker
            selected={mentions}
            onToggle={(id) =>
              setMentions((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
            }
            onClose={() => setPicking(false)}
          />
        )}

        {mentions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {mentions.map((id) => (
              <span
                key={id}
                className="flex items-center gap-1 rounded-full bg-busy-tint px-2.5 py-0.5 text-[12px] text-busy-ink"
              >
                {nameOf(id)}
                <button
                  onClick={() => setMentions((prev) => prev.filter((m) => m !== id))}
                  aria-label={`הסרת ${nameOf(id)}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {pendingFile && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-[13px]">
            <Paperclip className="size-4 shrink-0 text-ink-subtle" />
            <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
            <button onClick={() => setPendingFile(null)} aria-label="הסרת הקובץ">
              <X className="size-3.5 text-ink-subtle hover:text-ink" />
            </button>
          </div>
        )}

        {recording ? (
          <div className="flex items-center gap-3 rounded-lg bg-urgent-tint px-3 py-2.5">
            <span className="size-2.5 animate-pulse rounded-full bg-urgent" />
            <span className="numeric flex-1 text-[14px] font-medium text-urgent-ink" dir="ltr">
              {formatDuration(elapsed)}
            </span>
            <Button size="sm" variant="secondary" onClick={() => stopRecording(true)}>
              בטל
            </Button>
            <Button size="sm" onClick={() => stopRecording()}>
              <Square className="size-3.5 fill-current" />
              סיים ושלח
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              rows={2}
              placeholder="כתוב הודעה לצוות…"
              className={cn(
                'min-h-[42px] flex-1 resize-none rounded-md border border-field bg-surface px-3 py-2',
                'text-[15px] text-ink placeholder:text-ink-faint',
                'transition-colors duration-micro ease-standard focus:border-steel-600',
              )}
            />

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setPicking((v) => !v)}
                aria-label="שליחה למשתמש"
                className={cn(
                  'rounded-md p-2 transition-colors duration-micro',
                  mentions.length ? 'bg-busy-tint text-busy-ink' : 'text-ink-muted hover:bg-ink/[0.06]',
                )}
              >
                <AtSign className="size-[18px]" />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="צירוף קובץ"
                className="rounded-md p-2 text-ink-muted transition-colors duration-micro hover:bg-ink/[0.06]"
              >
                <Paperclip className="size-[18px]" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={(e) => {
                  setPendingFile(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />

              <button
                type="button"
                onClick={startRecording}
                aria-label="הקלטת הודעה קולית"
                className="rounded-md p-2 text-ink-muted transition-colors duration-micro hover:bg-ink/[0.06]"
              >
                <Mic className="size-[18px]" />
              </button>

              <Button
                size="sm"
                onClick={submit}
                loading={send.isPending}
                loadingLabel=""
                disabled={!draft.trim() && !pendingFile}
                aria-label="שליחה"
                className="h-[42px] px-3"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

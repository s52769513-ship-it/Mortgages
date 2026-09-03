import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { dateTime, initials, relative } from '@/lib/format'
import type { Comment } from '@/types'
import { Button } from '@/components/ui/Button'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'

export type ChatEntity = 'CLIENT' | 'MORTGAGE_FILE' | 'TASK' | 'DOCUMENT' | 'BANK_APPLICATION'

/**
 * Internal team thread. Mounted on every entity card — the discussion lives
 * next to the record it is about, not in a separate inbox.
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
  const endRef = useRef<HTMLDivElement>(null)

  const key = ['comments', entityType, entityId]
  const path = `/comments/${entityType}/${entityId}`

  const { data: comments, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<Comment[]>(path),
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [comments?.length])

  const send = useMutation({
    mutationFn: (body: string) => api.post<Comment>(path, { body }),
    onSuccess: (created) => {
      queryClient.setQueryData<Comment[]>(key, (prev) => [...(prev ?? []), created])
      setDraft('')
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
    if (body) send.mutate(body)
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : !comments?.length ? (
          <EmptyState
            icon={<MessageSquare className="size-5" />}
            title="אין עדיין הודעות"
            description="זה המקום לדיון הפנימי של הצוות על הרשומה הזו."
            className="py-10"
          />
        ) : (
          comments.map((c) => {
            const mine = c.author.id === user?.id
            return (
              <div key={c.id} className="group flex gap-3">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
                    mine ? 'bg-steel-600 text-white' : 'bg-surface-raised text-ink-muted',
                  )}
                >
                  {initials(c.author.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-ink">{c.author.name}</span>
                    <time
                      className="text-[11.5px] text-ink-subtle"
                      title={dateTime(c.createdAt)}
                    >
                      {relative(c.createdAt)}
                    </time>
                    {c.editedAt && <span className="text-[11.5px] text-ink-subtle">(נערך)</span>}

                    {mine && (
                      <button
                        onClick={() => remove.mutate(c.id)}
                        aria-label="מחיקת הודעה"
                        className={cn(
                          'mr-auto rounded p-1 text-ink-subtle opacity-0',
                          'transition-all duration-micro ease-standard',
                          'hover:bg-urgent-tint hover:text-urgent',
                          'group-hover:opacity-100 focus-visible:opacity-100',
                        )}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-muted">
                    {c.body}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-hair bg-paper p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter breaks the line.
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
              'transition-colors duration-micro ease-standard',
              'focus:border-steel-600',
            )}
          />
          <Button
            size="sm"
            onClick={submit}
            loading={send.isPending}
            disabled={!draft.trim()}
            aria-label="שליחה"
            className="h-[42px] px-3"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

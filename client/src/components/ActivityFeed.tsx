import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { api } from '@/api/client'
import { dateTime, relative } from '@/lib/format'
import type { ActivityEntry } from '@/types'
import { EmptyState, Skeleton } from '@/components/ui/States'
import type { ChatEntity } from '@/components/InternalChat'

export function ActivityFeed({
  entityType,
  entityId,
}: {
  entityType: ChatEntity
  entityId: string
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['activity', entityType, entityId],
    queryFn: () => api.get<ActivityEntry[]>(`/activity/${entityType}/${entityId}`),
  })

  if (isLoading) {
    return (
      <div className="space-y-3 p-5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-3" />
        ))}
      </div>
    )
  }

  if (!data?.length) {
    return (
      <EmptyState
        icon={<History className="size-5" />}
        title="אין עדיין פעילות"
        description="כל שינוי ברשומה יתועד כאן אוטומטית."
        className="py-10"
      />
    )
  }

  return (
    <ol className="relative px-5 py-4">
      {/* Spine of the timeline. */}
      <span className="absolute bottom-4 right-[25px] top-4 w-px bg-ink/10" aria-hidden />

      {data.map((entry) => (
        <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
          <span className="relative z-10 mt-1.5 size-2 shrink-0 rounded-full bg-steel-600 ring-4 ring-surface" />

          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink">
              <span className="font-medium">{entry.actor?.name ?? 'המערכת'}</span>{' '}
              <span className="text-ink-muted">{entry.action}</span>
            </p>

            {entry.field && (
              <p className="mt-0.5 text-[12px] text-ink-muted">
                <span className="text-ink-subtle">{entry.field}:</span>{' '}
                <span className="line-through decoration-ink-subtle/60">
                  {entry.oldValue || '—'}
                </span>{' '}
                ← <span className="font-medium text-ink">{entry.newValue || '—'}</span>
              </p>
            )}

            <time className="mt-0.5 block text-[11.5px] text-ink-subtle" title={dateTime(entry.createdAt)}>
              {relative(entry.createdAt)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  )
}

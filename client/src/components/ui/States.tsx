import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { Tone } from '@/lib/labels'

const TINTS: Record<Tone, string> = {
  neutral: 'bg-surface-raised text-ink-faint',
  busy: 'bg-busy-tint text-busy',
  ok: 'bg-ok-tint text-ok',
  wait: 'bg-wait-tint text-wait',
  urgent: 'bg-urgent-tint text-urgent',
}

/**
 * Three layers, always: what happened, what it means, what to do next.
 * There is no bare "no data" state — every empty view offers one action.
 * An empty result caused by a filter is a different state from a genuinely
 * empty list, and gets a different action.
 */
export function EmptyState({
  icon,
  tone = 'neutral',
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  tone?: Tone
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {icon && (
        <div
          className={cn(
            'mb-4 flex size-[78px] items-center justify-center rounded-full',
            TINTS[tone],
          )}
          aria-hidden
        >
          {icon}
        </div>
      )}
      <h3 className="font-heading text-[20px] font-medium text-ink">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden />
}

/**
 * Three rows, held steady between loads. Nothing renders under 300ms — a
 * flash of skeleton is worse than a brief blank.
 */
export function TableSkeleton({ rows = 3, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-row" aria-busy="true" aria-label="טוען נתונים">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-5 px-7 py-5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn(
                c === 0 ? 'w-1/4' : c === cols - 1 ? 'w-16 rounded-full' : 'w-1/6',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex size-[78px] items-center justify-center rounded-full bg-urgent-tint">
        <span className="font-heading text-[26px] text-urgent" aria-hidden>
          !
        </span>
      </div>
      <h3 className="font-heading text-[20px] font-medium text-ink">משהו השתבש</h3>
      <p className="mt-2 max-w-sm text-[15px] text-ink-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 text-[14px] font-medium text-steel-700 underline underline-offset-[3px]"
        >
          נסה שוב
        </button>
      )}
    </div>
  )
}

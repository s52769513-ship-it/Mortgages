import { cn } from '@/lib/cn'
import type { Tone } from '@/lib/labels'

const VALUE_COLOR: Record<Tone, string> = {
  neutral: 'text-ink',
  busy: 'text-ink',
  ok: 'text-ok-ink',
  wait: 'text-wait',
  urgent: 'text-urgent',
}

const CHIP: Record<Tone, string> = {
  neutral: 'border border-field text-ink-muted rounded-md',
  busy: 'bg-busy-tint text-busy-ink rounded-full',
  ok: 'bg-ok-tint text-ok-ink rounded-full',
  wait: 'bg-wait-tint text-wait-ink rounded-full',
  urgent: 'bg-urgent-tint text-urgent-ink rounded-full',
}

/**
 * One of the four dashboard metrics. Every card is a link into the list it
 * summarises — the number is never a dead end.
 */
export function KpiCard({
  label,
  value,
  chip,
  chipTone = 'neutral',
  hint,
  delta,
  deltaTone = 'neutral',
  tone = 'neutral',
  accent = false,
  onClick,
}: {
  label: string
  value: number | string
  chip?: string
  chipTone?: Tone
  /** A short qualifier under the number — what it counts, not how it changed. */
  hint?: string
  delta?: string
  deltaTone?: Tone
  tone?: Tone
  /** Draws the 3px top rule — reserved for the metric that needs attention. */
  accent?: boolean
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-1 rounded-lg border border-row bg-surface px-5 py-4 text-right',
        'shadow-raised transition-colors duration-micro ease-standard',
        accent && 'border-t-[3px] border-t-urgent',
        onClick && 'cursor-pointer hover:bg-ink/[0.02]',
      )}
    >
      <span className="text-[12px] font-semibold text-ink-muted">{label}</span>

      <span className="flex items-center justify-between gap-3">
        <span
          className={cn('numeric text-[34px] font-semibold leading-[0.9]', VALUE_COLOR[tone])}
          dir="ltr"
        >
          {value}
        </span>

        {chip && (
          <span className={cn('px-3 py-1 text-[11.5px] font-semibold', CHIP[chipTone])}>
            {chip}
          </span>
        )}
      </span>

      {hint && <span className="text-[12px] text-ink-subtle">{hint}</span>}

      {delta && (
        <span
          className={cn(
            'text-[12px]',
            deltaTone === 'ok' && 'text-ok-ink',
            deltaTone === 'urgent' && 'text-urgent-ink',
            deltaTone === 'wait' && 'text-wait-ink',
            (deltaTone === 'neutral' || deltaTone === 'busy') && 'text-ink-muted',
          )}
        >
          {delta}
        </span>
      )}
    </Tag>
  )
}

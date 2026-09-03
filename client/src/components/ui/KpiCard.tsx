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

const BAR: Record<Tone, string> = {
  neutral: 'bg-rail',
  busy: 'bg-steel-600',
  ok: 'bg-ok',
  wait: 'bg-wait',
  urgent: 'bg-urgent',
}

/** Four bars, the last one carrying the accent — a trend, not a chart. */
export function Sparkline({ values, tone = 'busy' }: { values: number[]; tone?: Tone }) {
  const max = Math.max(1, ...values)
  return (
    <span className="flex h-[26px] items-end gap-1" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            'w-[7px] rounded-sm',
            i === values.length - 1 ? BAR[tone] : 'bg-steel-300',
          )}
          style={{ height: `${Math.max(20, (v / max) * 100)}%` }}
        />
      ))}
    </span>
  )
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
  spark,
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
  spark?: number[]
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

        {spark ? (
          <Sparkline values={spark} tone={tone} />
        ) : chip ? (
          <span className={cn('px-3 py-1 text-[11.5px] font-semibold', CHIP[chipTone])}>
            {chip}
          </span>
        ) : null}
      </span>

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

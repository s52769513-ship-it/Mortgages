import { cn } from '@/lib/cn'
import type { Tone } from '@/lib/labels'

/**
 * Colour is never alone: the chip always carries its word. Neutral renders as
 * an outline rather than a fill, which is what separates "not relevant" and
 * "new lead" from the four real states.
 */
const TONES: Record<Tone, string> = {
  neutral: 'border border-field text-ink-muted rounded-md',
  busy: 'bg-busy-tint text-busy-ink rounded-full',
  ok: 'bg-ok-tint text-ok-ink rounded-full',
  wait: 'bg-wait-tint text-wait-ink rounded-full',
  urgent: 'bg-urgent-tint text-urgent-ink rounded-full',
}

const DOTS: Record<Tone, string> = {
  neutral: 'bg-rail',
  busy: 'bg-busy',
  ok: 'bg-ok',
  wait: 'bg-wait',
  urgent: 'bg-urgent',
}

export function Badge({
  tone = 'neutral',
  dot = false,
  children,
  className,
}: {
  tone?: Tone
  dot?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 text-[12px] font-semibold',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-2 shrink-0 rounded-full', DOTS[tone])} aria-hidden />}
      {children}
    </span>
  )
}

/** The 4px status rail on the start edge of every table row and task row. */
export const RAILS: Record<Tone, string> = {
  neutral: 'border-rail',
  busy: 'border-busy',
  ok: 'border-ok',
  wait: 'border-wait',
  urgent: 'border-urgent',
}

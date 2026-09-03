import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { date } from '@/lib/format'
import { FILE_STAGE, STAGE_ORDER, type Stage } from '@/lib/labels'

type StepState = 'done' | 'current' | 'blocked' | 'future'

/**
 * The file pipeline. Four visual states, and colour is never the only signal:
 * a blocked step carries a glyph and a reason line, a completed one a check.
 * Clicking a step filters the tasks and documents below it.
 */
export function FileStepper({
  current,
  blocked = false,
  blockReason,
  completedAt,
  selected,
  onSelect,
  className,
}: {
  current: Stage | string
  blocked?: boolean
  blockReason?: string | null
  completedAt?: Partial<Record<Stage, string | null>>
  selected?: Stage | null
  onSelect?: (stage: Stage | null) => void
  className?: string
}) {
  const currentIndex = STAGE_ORDER.indexOf(current as Stage)

  const stateOf = (index: number): StepState => {
    if (index < currentIndex) return 'done'
    if (index > currentIndex) return 'future'
    return blocked ? 'blocked' : 'current'
  }

  return (
    <ol
      className={cn('flex items-start gap-0 overflow-x-auto', className)}
      aria-label="שלבי התיק"
    >
      {STAGE_ORDER.map((stage, i) => {
        const state = stateOf(i)
        const isSelected = selected === stage
        const next = stateOf(i + 1)

        return (
          <li key={stage} className="flex min-w-0 flex-1 items-start">
            <div className="flex min-w-[104px] flex-1 flex-col items-center gap-2">
              <button
                type="button"
                disabled={!onSelect}
                onClick={() => onSelect?.(isSelected ? null : stage)}
                aria-current={state === 'current' || state === 'blocked' ? 'step' : undefined}
                aria-pressed={onSelect ? isSelected : undefined}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-md px-2 py-1',
                  'transition-colors duration-micro ease-standard',
                  onSelect ? 'cursor-pointer hover:bg-ink/[0.04]' : 'cursor-default',
                  isSelected && 'bg-busy-tint',
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center rounded-full font-heading font-medium',
                    'transition-all duration-base ease-standard',
                    state === 'current'
                      ? // The current node is 30% larger and carries a soft halo.
                        'size-[34px] bg-steel-600 text-[13px] text-white ring-4 ring-busy-tint'
                      : 'size-[26px] text-[12px]',
                    state === 'done' && 'bg-ok text-white',
                    state === 'blocked' &&
                      'size-[34px] border-2 border-urgent bg-urgent-tint text-urgent-ink ring-4 ring-urgent-tint',
                    state === 'future' && 'border-2 border-[rgb(212,212,215)] bg-surface text-ink-subtle',
                  )}
                >
                  {state === 'done' ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : state === 'blocked' ? (
                    '!'
                  ) : (
                    <span className="numeric">{String(i + 1).padStart(2, '0')}</span>
                  )}
                </span>

                <span
                  className={cn(
                    'text-center text-[13px] leading-tight transition-colors duration-base',
                    state === 'done' && 'text-ok-ink',
                    state === 'current' && 'font-semibold text-steel-800',
                    state === 'blocked' && 'font-semibold text-urgent-ink',
                    state === 'future' && 'text-ink-faint',
                  )}
                >
                  {FILE_STAGE[stage].label}
                </span>
              </button>

              {state === 'done' && completedAt?.[stage] && (
                <span className="numeric text-[11px] text-ink-subtle" dir="ltr">
                  {date(completedAt[stage])}
                </span>
              )}
              {state === 'blocked' && blockReason && (
                <span className="max-w-[140px] text-center text-[11.5px] leading-snug text-urgent-ink">
                  חסום — {blockReason}
                </span>
              )}
            </div>

            {i < STAGE_ORDER.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'mt-[13px] h-1 flex-1 rounded-full',
                  state === 'done' && 'bg-ok',
                  (state === 'current' || state === 'blocked') &&
                    'bg-gradient-to-l from-steel-600 to-[rgb(212,212,215)]',
                  state === 'future' && next === 'future' && 'bg-surface-raised',
                  state === 'future' && next !== 'future' && 'bg-surface-raised',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Mobile fallback — one line plus a progress bar. */
export function CompactStepper({ current }: { current: Stage | string }) {
  const index = STAGE_ORDER.indexOf(current as Stage)
  const step = index + 1

  return (
    <div className="space-y-2">
      <p className="text-[13.5px] font-medium text-ink">
        שלב <span className="numeric">{step}</span> מתוך{' '}
        <span className="numeric">{STAGE_ORDER.length}</span> ·{' '}
        {FILE_STAGE[(STAGE_ORDER[index] ?? STAGE_ORDER[0]) as Stage].label}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full bg-steel-600 transition-[width] duration-base ease-standard"
          style={{ width: `${(step / STAGE_ORDER.length) * 100}%` }}
        />
      </div>
    </div>
  )
}

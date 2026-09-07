import { useEffect, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'

/**
 * Picks a financing percentage from the office's own shortlist, with room
 * for whatever number is not on it.
 *
 * The list itself lives in Settings, not here — a broker's shortlist is
 * theirs to set (75% for a first apartment, 50% for an investment property,
 * whatever the office actually quotes), and typing the same handful of
 * numbers by hand on every file is exactly what this replaces. A chip that
 * turns out not to fit is never a dead end: "אחר" reveals a plain number box.
 */

const FALLBACK_PRESETS = [50, 60, 70, 75, 80]

export function LtvPicker({
  label = 'אחוז מימון',
  value,
  onChange,
  hint,
}: {
  label?: string
  /** The number as a string, matching every other numeric field on the form. */
  value: string
  onChange: (value: string) => void
  hint?: string
}) {
  const id = useId()

  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Record<string, unknown>>('/settings'),
    staleTime: 5 * 60_000,
  })
  const presets = Array.isArray(data?.ltvPresets)
    ? (data!.ltvPresets as number[])
    : FALLBACK_PRESETS

  const numeric = value.trim() === '' ? null : Number(value)
  const onList = numeric !== null && Number.isFinite(numeric) && presets.includes(numeric)

  // "אחר" stays open once chosen, even while its box is empty, so typing a
  // number does not require clicking the chip again on every keystroke.
  const [other, setOther] = useState(value.trim() !== '' && !onList)
  useEffect(() => {
    if (onList) setOther(false)
  }, [onList])

  return (
    <div className="space-y-1.5">
      <span id={id} className="block text-[12px] font-semibold text-ink-muted">
        {label}
      </span>

      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const selected = !other && numeric === p
          return (
            <button
              key={p}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setOther(false)
                onChange(String(p))
              }}
              className={cn(
                'numeric h-9 rounded-md border px-3.5 text-[14px] font-medium',
                'transition-colors duration-micro ease-standard',
                selected
                  ? 'border-steel-600 bg-steel-600 text-white shadow-button'
                  : 'border-field text-ink hover:bg-ink/[0.04]',
              )}
              dir="ltr"
            >
              {p}%
            </button>
          )
        })}

        <button
          type="button"
          aria-pressed={other}
          onClick={() => {
            setOther(true)
            if (onList) onChange('')
          }}
          className={cn(
            'h-9 rounded-md border px-3.5 text-[14px] font-medium',
            'transition-colors duration-micro ease-standard',
            other
              ? 'border-steel-600 bg-steel-600 text-white shadow-button'
              : 'border-field text-ink hover:bg-ink/[0.04]',
          )}
        >
          אחר
        </button>
      </div>

      {other && (
        <input
          autoFocus
          type="number"
          min={0}
          max={100}
          dir="ltr"
          aria-label={`${label} — אחוז מותאם אישית`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="אחוז מותאם אישית"
          className={cn(
            'numeric h-10 w-full max-w-[160px] rounded-md border border-field bg-surface px-3 text-[15px] text-ink',
            'placeholder:text-ink-faint transition-colors duration-micro ease-standard',
            'focus:border-steel-600',
          )}
        />
      )}

      {hint && !other && <p className="text-[12px] text-ink-subtle">{hint}</p>}
    </div>
  )
}

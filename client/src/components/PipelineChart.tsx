import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { FILE_STAGE, STAGE_ORDER, type Stage } from '@/lib/labels'

export type PipelineRow = {
  stage: string
  active: number
  blocked: number
  onHold: number
}

/**
 * Chart-only colours. The interface palette is deliberately muted, which reads
 * as grey once it is a large filled block; these are the nearest steps in the
 * same hues that clear the chroma floor and stay apart under colour-vision
 * deficiency. Verified with the palette validator, all pairs.
 */
const SERIES = [
  { key: 'active', label: 'בטיפול', color: '#3d78ad' },
  { key: 'onHold', label: 'בהמתנה', color: '#c9962b' },
  { key: 'blocked', label: 'חסום', color: '#b8483d' },
] as const

type SeriesKey = (typeof SERIES)[number]['key']

type Hover = { stage: string; key: SeriesKey; count: number; x: number; y: number } | null

export function PipelineChart({ rows }: { rows: PipelineRow[] }) {
  const navigate = useNavigate()
  const [hover, setHover] = useState<Hover>(null)

  const byStage = new Map(rows.map((r) => [r.stage, r]))
  const totals = STAGE_ORDER.map((stage) => {
    const row = byStage.get(stage) ?? { stage, active: 0, blocked: 0, onHold: 0 }
    return { ...row, total: row.active + row.blocked + row.onHold }
  })

  const max = Math.max(1, ...totals.map((t) => t.total))
  const grandTotal = totals.reduce((sum, t) => sum + t.total, 0)

  if (grandTotal === 0) {
    return (
      <p className="px-6 py-10 text-center text-[14px] text-ink-muted">
        אין תיקים פתוחים כרגע. ברגע שייפתח תיק, מיקומו בצנרת יופיע כאן.
      </p>
    )
  }

  return (
    <div className="px-6 py-5">
      {/* A legend is present because there is more than one series, so identity
          is never carried by colour alone. */}
      <ul className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: series.color }}
              aria-hidden
            />
            {series.label}
          </li>
        ))}
      </ul>

      <div className="relative space-y-2.5">
        {totals.map((row) => {
          const stage = row.stage as Stage
          const segments = SERIES.map((s) => ({ ...s, count: row[s.key] })).filter(
            (s) => s.count > 0,
          )

          return (
            <div key={row.stage} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-[13px] text-ink-muted">
                {FILE_STAGE[stage]?.label ?? row.stage}
              </span>

              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className="flex h-5 items-stretch gap-[2px]"
                  style={{ width: `${(row.total / max) * 100}%` }}
                  role="img"
                  aria-label={`${FILE_STAGE[stage]?.label}: ${row.total} תיקים`}
                >
                  {segments.map((segment, i) => (
                    <button
                      key={segment.key}
                      type="button"
                      onClick={() => navigate(`/files?stage=${row.stage}`)}
                      onMouseEnter={(e) => {
                        const box = e.currentTarget.getBoundingClientRect()
                        setHover({
                          stage: FILE_STAGE[stage]?.label ?? row.stage,
                          key: segment.key,
                          count: segment.count,
                          x: box.left + box.width / 2,
                          y: box.top,
                        })
                      }}
                      onMouseLeave={() => setHover(null)}
                      className={cn(
                        'h-full transition-opacity duration-micro ease-standard hover:opacity-85',
                        // Only the outer ends of the whole bar are rounded, so
                        // the segments read as one bar rather than separate pills.
                        i === 0 && 'rounded-s-[4px]',
                        i === segments.length - 1 && 'rounded-e-[4px]',
                      )}
                      style={{
                        background: segment.color,
                        flexGrow: segment.count,
                        flexBasis: 0,
                        minWidth: 3,
                      }}
                    />
                  ))}
                </div>

                {/* Outside the bar, so a short bar never clips its own label. */}
                <span className="numeric shrink-0 text-[13px] font-medium text-ink" dir="ltr">
                  {row.total || '—'}
                </span>
              </div>
            </div>
          )
        })}

        {hover && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-steel-900 px-2.5 py-1.5 text-[12.5px] text-white shadow-modal"
            style={{ left: hover.x, top: hover.y - 8 }}
          >
            {hover.stage} ·{' '}
            {SERIES.find((s) => s.key === hover.key)?.label}{' '}
            <span className="numeric" dir="ltr">
              {hover.count}
            </span>
          </div>
        )}
      </div>

      <p className="mt-4 border-t border-hair pt-3 text-[12.5px] text-ink-subtle">
        לחיצה על פס פותחת את רשימת התיקים באותו שלב.
      </p>
    </div>
  )
}

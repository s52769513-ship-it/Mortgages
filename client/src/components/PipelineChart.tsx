import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { FILE_STAGE, STAGE_ORDER, type Stage } from '@/lib/labels'

export type PipelineRow = {
  stage: string
  active: number
  blocked: number
  onHold: number
  /** Days the longest-standing file has been in this stage; null when empty. */
  oldestDays?: number | null
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

/**
 * A stage holding one file still has to be visible and clickable, but the
 * floor is in pixels, not percent: adding a percentage to every band would
 * stretch the small ones and the bands would stop being comparable.
 */
const MIN_BAND_PX = 10

/**
 * The pipeline drawn as a funnel: one band per stage, top to bottom in the
 * order work moves, each band as wide as the number of files sitting in it.
 *
 * Read it for where the width swells rather than where it narrows. This is a
 * snapshot of where files are right now, not a conversion funnel — a stage
 * wider than the one above it is not a gain, it is a queue that is not
 * clearing, which is the thing worth seeing from across the room.
 */
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
  // Width is the value, straight. A band twice as wide holds twice as many.
  const widthOf = (total: number) => (total / max) * 100

  if (grandTotal === 0) {
    return (
      <p className="px-6 py-10 text-center text-[14px] text-ink-muted">
        אין תיקים פתוחים כרגע. ברגע שייפתח תיק, מיקומו בצנרת יופיע כאן.
      </p>
    )
  }

  const busiest = totals.reduce((a, b) => (b.total > a.total ? b : a))
  // Where nothing has moved for longest. Not the same stage as the busiest
  // one, and usually the more urgent of the two.
  const stalest = totals.reduce<(typeof totals)[number] | null>(
    (worst, row) =>
      row.total > 0 && (row.oldestDays ?? 0) > (worst?.oldestDays ?? -1) ? row : worst,
    null,
  )

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

      <div className="relative">
        {totals.map((row, i) => {
          const stage = FILE_STAGE[row.stage as Stage]
          const width = widthOf(row.total)
          const next = totals[i + 1]
          const nextWidth = next ? widthOf(next.total) : null
          const isBusiest = row.total === busiest.total && row.total > 0
          const isStalest = stalest?.stage === row.stage && (row.oldestDays ?? 0) > 0

          return (
            <div key={row.stage}>
              <div
                className="grid items-center gap-4"
                style={{ gridTemplateColumns: '132px 1fr 40px 56px' }}
              >
                <span
                  className={cn(
                    'truncate text-[13.5px]',
                    isBusiest ? 'font-semibold text-ink' : 'text-ink-muted',
                  )}
                >
                  {stage?.label ?? row.stage}
                </span>

                {/* The band is centred, so the column of bands reads as a funnel
                    whose silhouette is the shape of the workload. */}
                <div className="flex h-8 items-center justify-center">
                  {row.total === 0 ? (
                    <span className="h-[3px] w-8 rounded-full bg-hair" aria-hidden />
                  ) : (
                    <div
                      className="flex h-8 gap-[2px]"
                      style={{ width: `${width}%`, minWidth: MIN_BAND_PX }}
                    >
                      {SERIES.map((series, s) => {
                        const count = row[series.key]
                        if (count === 0) return null
                        const first = SERIES.slice(0, s).every((p) => row[p.key] === 0)
                        const last = SERIES.slice(s + 1).every((n) => row[n.key] === 0)

                        return (
                          <button
                            key={series.key}
                            type="button"
                            style={{
                              flexGrow: count,
                              background: series.color,
                              borderStartStartRadius: first ? 4 : 0,
                              borderEndStartRadius: first ? 4 : 0,
                              borderStartEndRadius: last ? 4 : 0,
                              borderEndEndRadius: last ? 4 : 0,
                            }}
                            className="min-w-[3px] transition-opacity duration-micro hover:opacity-85"
                            aria-label={`${stage?.label} · ${series.label} · ${count}`}
                            onMouseEnter={(e) => {
                              const r = e.currentTarget.getBoundingClientRect()
                              setHover({
                                stage: stage?.label ?? row.stage,
                                key: series.key,
                                count,
                                x: r.left + r.width / 2,
                                y: r.top,
                              })
                            }}
                            onMouseLeave={() => setHover(null)}
                            onClick={() => navigate(`/files?stage=${row.stage}`)}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>

                <span
                  className={cn(
                    'numeric text-[14px] tabular-nums',
                    isBusiest ? 'font-semibold text-ink' : 'text-ink-muted',
                  )}
                  dir="ltr"
                >
                  {row.total}
                </span>

                {/* How long the oldest file here has been waiting. A narrow
                    stage with a large number is a file nobody is touching. */}
                <span
                  className={cn(
                    'text-[12.5px] tabular-nums',
                    isStalest ? 'font-semibold text-urgent-ink' : 'text-ink-subtle',
                  )}
                  title={
                    row.oldestDays === null || row.oldestDays === undefined
                      ? undefined
                      : `הוותיק בשלב: ${row.oldestDays} ימים`
                  }
                >
                  {row.total === 0 || row.oldestDays === null || row.oldestDays === undefined
                    ? '—'
                    : `${row.oldestDays} ימ׳`}
                </span>
              </div>

              {/* The taper between two stages. Recessive: it is the shape, not
                  a value — the numbers are on the bands themselves. */}
              {nextWidth !== null && (
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: '132px 1fr 40px 56px' }}
                >
                  <span />
                  <div
                    className="h-3 bg-steel-700/[0.09]"
                    aria-hidden
                    style={{
                      clipPath: `polygon(${50 - width / 2}% 0, ${50 + width / 2}% 0, ${50 + nextWidth / 2}% 100%, ${50 - nextWidth / 2}% 100%)`,
                    }}
                  />
                  <span />
                  <span />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-4 border-t border-hair pt-3 text-[12.5px] leading-relaxed text-ink-subtle">
        רוחב הפס הוא מספר התיקים באותו שלב, והמספר משמאלו הוא כמה ימים התיק
        הוותיק שם ממתין. שלב צר עם מספר ימים גבוה הוא תיק שאיש אינו נוגע בו —
        לרוב דחוף יותר משלב רחב שזז. לחיצה על פס פותחת את התיקים באותו שלב.
      </p>

      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-ink px-2.5 py-1.5 text-[12.5px] text-white shadow-modal"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          {hover.stage} · {SERIES.find((s) => s.key === hover.key)?.label}{' '}
          <span className="numeric" dir="ltr">
            {hover.count}
          </span>
        </div>
      )}
    </div>
  )
}

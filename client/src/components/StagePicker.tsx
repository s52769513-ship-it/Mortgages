import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { FILE_STAGE, STAGE_ORDER, type Stage } from '@/lib/labels'
import { Menu, MenuItem, MenuLabel } from '@/components/ui/Menu'

/**
 * Where a file stands in the six-step pipeline, and a one-click way to move
 * it — wherever a file is listed, not only on its own page.
 *
 * A stage is a position, not a category: "בקשה לבנק" on its own says less
 * than seeing it is the third of six steps, three behind the finish line.
 * The six segments carry that at a glance — filled up to the current step —
 * with the name written out beside them, since a shape alone is not a label.
 * Clicking it opens the same jump-to-any-stage menu the pipeline board uses,
 * so a row in a table is exactly as fast to move as a card on the board.
 */
export function StagePicker({
  fileId,
  fileNumber,
  stage,
  onMove,
  moving = false,
}: {
  fileId: string
  fileNumber: string
  stage: string
  onMove: (fileId: string, stage: Stage) => void
  moving?: boolean
}) {
  const index = STAGE_ORDER.indexOf(stage as Stage)
  const label = FILE_STAGE[stage as Stage]?.label ?? stage

  return (
    <span
      // The row this sits in is very often a link to the file itself. Both
      // calls are needed: stopPropagation keeps the row's own click handler
      // from also firing, and preventDefault stops the browser from
      // following the row's anchor natively — stopPropagation alone does
      // not touch that default action.
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <Menu
        label={`העברת התיק ${fileNumber} לשלב אחר`}
        align="end"
        width={220}
        trigger={({ open }) => (
          <span
            className={cn(
              '-mx-1.5 -my-1 inline-flex items-center gap-2 rounded-md px-1.5 py-1',
              'transition-colors duration-micro ease-standard hover:bg-ink/[0.05]',
              open && 'bg-ink/[0.06]',
              moving && 'pointer-events-none opacity-55',
            )}
          >
            {moving ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-ink-subtle" />
            ) : (
              <span className="flex shrink-0 items-center gap-[3px]" aria-hidden>
                {STAGE_ORDER.map((s, i) => (
                  <span
                    key={s}
                    className={cn(
                      'h-1.5 w-3.5 rounded-full transition-colors duration-micro ease-standard',
                      i <= index ? 'bg-steel-600' : 'bg-hair',
                    )}
                  />
                ))}
              </span>
            )}
            <span className="truncate text-[13.5px] text-ink">{label}</span>
          </span>
        )}
      >
        {(close) => (
          <>
            <MenuLabel>העברה לשלב</MenuLabel>
            {STAGE_ORDER.map((s) => (
              <MenuItem
                key={s}
                disabled={s === stage}
                onClick={() => {
                  onMove(fileId, s)
                  close()
                }}
              >
                {FILE_STAGE[s].label}
              </MenuItem>
            ))}
          </>
        )}
      </Menu>
    </span>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GripVertical, MoveRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { date, money } from '@/lib/format'
import {
  FILE_STAGE,
  FILE_STATUS,
  labelOf,
  STAGE_ORDER,
  URGENCY,
  type Stage,
  type Tone,
} from '@/lib/labels'
import { useFileStatusTone } from '@/lib/fileStatusColor'
import type { MortgageFile } from '@/types'
import { Badge, RAILS } from '@/components/ui/Badge'
import { Menu, MenuItem, MenuLabel } from '@/components/ui/Menu'

/**
 * The pipeline read as six columns. It answers one question the table cannot:
 * where the work is piling up. Moving a card is the same PATCH the stepper on
 * the file page performs, so the two views never disagree.
 */

function FileCard({
  file,
  onMove,
  moving,
  statusTone,
}: {
  file: MortgageFile
  onMove: (id: string, stage: Stage) => void
  moving: boolean
  statusTone: Tone
}) {
  const status = labelOf(FILE_STATUS, file.status)
  const urgency = labelOf(URGENCY, file.urgency)
  const urgent = file.urgency === 'HIGH' || file.urgency === 'CRITICAL'
  const overdue = file.nextActionDate && new Date(file.nextActionDate) < new Date()

  return (
    <div
      draggable={!moving}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', file.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'group relative rounded-lg border border-hair border-s-4 bg-surface px-2 py-1.5',
        'shadow-surface transition-shadow duration-micro ease-standard hover:shadow-raised',
        moving ? 'cursor-progress opacity-55' : 'cursor-grab active:cursor-grabbing',
        RAILS[statusTone],
      )}
    >
      <div className="flex items-center gap-1.5">
        <GripVertical
          className="size-3.5 shrink-0 text-ink-subtle opacity-0 transition-opacity duration-micro group-hover:opacity-100"
          aria-hidden
        />
        {/* The client's name and the file number both open the same record —
            the board is a glance at where work sits, not a lookup by who or
            which file; the property address (or the file number, on the
            files still too new to have one) is what the office actually
            recognises a card by here. */}
        <Link
          to={`/files/${file.id}`}
          draggable={false}
          title={file.propertyAddress || file.fileNumber}
          className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink hover:text-steel-700"
        >
          {file.propertyAddress || file.fileNumber}
        </Link>

        {/* The status rides on the title's own line rather than a line of its
            own: it is two words at most, and a column that shows twice as
            many cards is the whole point of this view. */}
        <Badge tone={statusTone} className="shrink-0 px-1.5 py-0 text-[10.5px]">
          {status.label}
        </Badge>

        <Menu
          label={`העברת התיק ${file.fileNumber} לשלב אחר`}
          align="end"
          width={220}
          className="shrink-0"
          trigger={({ open }) => (
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded text-ink-subtle',
                'transition-colors duration-micro ease-standard hover:bg-ink/[0.06] hover:text-ink',
                open ? 'bg-ink/[0.06] text-ink' : 'opacity-0 group-hover:opacity-100',
              )}
            >
              <MoveRight className="size-3.5" />
            </span>
          )}
        >
          {(close) => (
            <>
              <MenuLabel>העברה לשלב</MenuLabel>
              {STAGE_ORDER.map((stage) => (
                <MenuItem
                  key={stage}
                  disabled={stage === file.stage}
                  onClick={() => {
                    onMove(file.id, stage)
                    close()
                  }}
                >
                  {FILE_STAGE[stage].label}
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
      </div>

      {/* One line for everything else, and none at all for a file that has no
          amount, no date and nothing urgent to say — which collapses those
          cards to a single row. */}
      {(urgent || file.requestedAmount || file.nextActionDate) && (
        <div className="mt-1 flex items-center gap-2 ps-5 text-[11.5px]">
          {urgent && (
            <Badge tone={urgency.tone} dot className="shrink-0 px-1.5 py-0 text-[10.5px]">
              {urgency.label}
            </Badge>
          )}
          {file.requestedAmount && (
            <span className="numeric truncate text-ink-muted" dir="ltr">
              {money(file.requestedAmount)}
            </span>
          )}
          {file.nextActionDate && (
            <span
              className={cn(
                'numeric ms-auto shrink-0',
                overdue ? 'text-urgent-ink' : 'text-ink-subtle',
              )}
              dir="ltr"
            >
              {date(file.nextActionDate)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function PipelineBoard({
  files,
  onMove,
  movingId,
}: {
  files: MortgageFile[]
  onMove: (id: string, stage: Stage) => void
  movingId?: string | null
}) {
  const [over, setOver] = useState<Stage | null>(null)
  const statusTone = useFileStatusTone()

  return (
    <div className="flex gap-4 overflow-x-auto px-5 py-5 lg:px-7">
      {STAGE_ORDER.map((stage) => {
        const column = files.filter((f) => f.stage === stage)
        const total = column.reduce((sum, f) => sum + Number(f.requestedAmount ?? 0), 0)

        return (
          <section
            key={stage}
            aria-label={FILE_STAGE[stage].label}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setOver(stage)
            }}
            onDragLeave={() => setOver((s) => (s === stage ? null : s))}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              const id = e.dataTransfer.getData('text/plain')
              const dropped = files.find((f) => f.id === id)
              if (dropped && dropped.stage !== stage) onMove(id, stage)
            }}
            className={cn(
              'flex w-[280px] shrink-0 flex-col rounded-lg border bg-paper/60',
              'transition-colors duration-micro ease-standard',
              over === stage ? 'border-steel-600 bg-steel-100' : 'border-hair',
            )}
          >
            <header className="flex items-baseline justify-between gap-2 border-b border-hair px-3.5 py-3">
              <h2 className="truncate text-[14px] font-semibold text-ink">
                {FILE_STAGE[stage].label}
              </h2>
              <span className="numeric shrink-0 text-[13px] text-ink-muted" dir="ltr">
                {column.length}
              </span>
            </header>

            {total > 0 && (
              <p className="numeric border-b border-hair px-3.5 py-2 text-[12.5px] text-ink-subtle" dir="ltr">
                {money(total)}
              </p>
            )}

            <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
              {column.length === 0 ? (
                <p className="m-auto px-2 text-center text-[13px] text-ink-faint">אין תיקים בשלב</p>
              ) : (
                column.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onMove={onMove}
                    moving={movingId === file.id}
                    statusTone={statusTone(file.status)}
                  />
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

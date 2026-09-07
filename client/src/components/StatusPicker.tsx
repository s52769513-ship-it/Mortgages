import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { FILE_STATUS, labelOf } from '@/lib/labels'
import { useFileStatusTone } from '@/lib/fileStatusColor'
import { Badge, DOTS as DOT } from '@/components/ui/Badge'
import { Menu, MenuItem, MenuLabel } from '@/components/ui/Menu'

const STATUS_ORDER = ['ACTIVE', 'ON_HOLD', 'BLOCKED', 'COMPLETED', 'CANCELLED'] as const

/**
 * A file's status, wherever it is listed — click it to jump straight to
 * another one, the same way a stage moves from StagePicker beside it.
 *
 * Unlike a stage, status has no order to show as progress; the badge and its
 * colour already say what it means, so this only adds the menu on top.
 */
export function StatusPicker({
  fileId,
  fileNumber,
  status,
  onMove,
  moving = false,
}: {
  fileId: string
  fileNumber: string
  status: string
  onMove: (fileId: string, status: string) => void
  moving?: boolean
}) {
  const current = labelOf(FILE_STATUS, status)
  const toneOf = useFileStatusTone()

  return (
    <span onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
      <Menu
        label={`שינוי מצב התיק ${fileNumber}`}
        align="end"
        width={190}
        trigger={({ open }) => (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md transition-opacity duration-micro ease-standard',
              moving && 'pointer-events-none opacity-55',
            )}
          >
            <Badge tone={toneOf(status)} dot>
              {current.label}
            </Badge>
            <ChevronDown
              className={cn('size-3 text-ink-subtle transition-transform', open && 'rotate-180')}
              aria-hidden
            />
          </span>
        )}
      >
        {(close) => (
          <>
            <MenuLabel>שינוי מצב</MenuLabel>
            {STATUS_ORDER.map((s) => {
              const entry = labelOf(FILE_STATUS, s)
              return (
                <MenuItem
                  key={s}
                  disabled={s === status}
                  onClick={() => {
                    onMove(fileId, s)
                    close()
                  }}
                >
                  <span
                    className={cn('size-2 shrink-0 rounded-full', DOT[toneOf(s)])}
                    aria-hidden
                  />
                  {entry.label}
                </MenuItem>
              )
            })}
          </>
        )}
      </Menu>
    </span>
  )
}


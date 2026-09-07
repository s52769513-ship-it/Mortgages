import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Tone } from '@/lib/labels'
import { Badge } from '@/components/ui/Badge'
import { Menu, MenuItem, MenuLabel } from '@/components/ui/Menu'

export type RowOption = { value: string; label: string; tone?: Tone }

/**
 * One field of a record, changed from the row it is listed in.
 *
 * The row itself opens the record, which is where the whole thing gets
 * edited. This is for the fields an office changes far more often than it
 * opens anything — a status, a priority, who is holding it — so they cost a
 * click instead of a round trip through a form.
 *
 * Two trigger shapes, because the same control has to sit in two kinds of
 * column: a badge where the value is a state worth colouring, and plain
 * text where it is just a name.
 */
export function RowSelect({
  menuLabel,
  heading,
  value,
  options,
  onSelect,
  pending = false,
  variant = 'badge',
  placeholder = '—',
  width = 200,
  className,
}: {
  /** Describes the control to a screen reader — "שינוי סטטוס המשימה …". */
  menuLabel: string
  /** Sits above the options, naming what is being changed. */
  heading: string
  value: string | null
  options: RowOption[]
  onSelect: (value: string) => void
  pending?: boolean
  variant?: 'badge' | 'text'
  placeholder?: string
  width?: number
  className?: string
}) {
  const current = options.find((o) => o.value === value)

  return (
    <span
      // Block, so the menu's own wrapper resolves a real width to lay the
      // trigger out against — inline, the label collapses to an ellipsis
      // long before it has run out of column.
      className="block"
      // The row around this is a link, or a button that opens the record.
      // Both calls are needed: stopPropagation keeps the row's own handler
      // from firing, and preventDefault stops the browser from following
      // the row's anchor natively — stopPropagation alone does not touch
      // that default action.
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <Menu
        label={menuLabel}
        align="end"
        width={width}
        // The table cell it sits in is min-w-0, so an inline trigger gets
        // squeezed to nothing. Filling the cell is what keeps the value
        // readable at the widths these columns actually get.
        triggerClassName="block w-full text-start"
        trigger={({ open }) => (
          <span
            className={cn(
              'flex w-full items-center gap-1 rounded-md',
              'transition-opacity duration-micro ease-standard',
              variant === 'text' &&
                '-mx-1.5 -my-1 px-1.5 py-1 transition-colors hover:bg-ink/[0.05]',
              variant === 'text' && open && 'bg-ink/[0.06]',
              pending && 'pointer-events-none opacity-55',
            )}
          >
            {variant === 'badge' && current ? (
              <Badge tone={current.tone ?? 'neutral'} dot>
                {current.label}
              </Badge>
            ) : (
              // min-w-0 is what lets truncate kick in only once the text has
              // actually run out of room, rather than at the first pixel.
              <span
                className={cn('min-w-0 truncate text-[13.5px]', className ?? 'text-ink-muted')}
              >
                {current?.label ?? placeholder}
              </span>
            )}
            <ChevronDown
              className={cn(
                'size-3 shrink-0 text-ink-subtle transition-transform',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </span>
        )}
      >
        {(close) => (
          <>
            <MenuLabel>{heading}</MenuLabel>
            {options.map((o) => (
              <MenuItem
                key={o.value}
                disabled={o.value === value}
                onClick={() => {
                  onSelect(o.value)
                  close()
                }}
              >
                {o.tone && (
                  <span className={cn('size-2 shrink-0 rounded-full', DOT[o.tone])} aria-hidden />
                )}
                {o.label}
              </MenuItem>
            ))}
          </>
        )}
      </Menu>
    </span>
  )
}

const DOT: Record<Tone, string> = {
  neutral: 'bg-rail',
  busy: 'bg-busy',
  ok: 'bg-ok',
  wait: 'bg-wait',
  urgent: 'bg-urgent',
}

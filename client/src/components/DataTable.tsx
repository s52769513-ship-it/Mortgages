import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Tone } from '@/lib/labels'
import { RAILS } from '@/components/ui/Badge'

/**
 * The shared list template. Clients, files, tasks and documents all use it —
 * only the columns and the filters differ.
 */

export type Column<T> = {
  key: string
  header: string
  /** CSS grid track for this column, e.g. "1.3fr" or "120px". */
  width: string
  render: (row: T) => ReactNode
  className?: string
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-hair px-7 py-4">
      {children}
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'h-10 min-w-[280px] flex-1 rounded-md border border-field bg-surface px-3 text-[15px]',
        'placeholder:text-ink-faint transition-colors duration-micro ease-standard',
        'focus:border-steel-600',
      )}
    />
  )
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-10 cursor-pointer rounded-md border border-field bg-surface px-3 text-[15px]',
        'transition-colors duration-micro ease-standard focus:border-steel-600',
        value ? 'text-ink' : 'text-ink-muted',
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** An applied filter reads as a square steel chip, distinct from an idle dropdown. */
export function ActiveFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 border border-steel-600 px-3 py-1.5 text-[13.5px] text-steel-700">
      {label}
      <button onClick={onClear} aria-label={`הסרת הסינון ${label}`} className="hover:text-steel-800">
        <X className="size-3.5" />
      </button>
    </span>
  )
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  toneOf,
  linkTo,
  rowActions,
  minWidth = 860,
}: {
  columns: Column<T>[]
  rows: T[]
  /** Drives the 4px status rail on the row's start edge. */
  toneOf?: (row: T) => Tone
  linkTo?: (row: T) => string
  rowActions?: (row: T) => ReactNode
  minWidth?: number
}) {
  const template = columns.map((c) => c.width).join(' ')

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth }} role="table">
        <div
          role="row"
          className="grid items-center gap-4 border-b border-hair px-7 py-4 text-[12px] font-semibold tracking-wide text-ink-muted"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((col) => (
            <span key={col.key} role="columnheader" className={col.className}>
              {col.header}
            </span>
          ))}
        </div>

        {rows.map((row, i) => {
          const tone = toneOf?.(row) ?? 'neutral'
          const content = (
            <div
              role="row"
              className={cn(
                'group relative grid items-center gap-4 border-s-4 px-7 py-4',
                'transition-colors duration-micro ease-standard hover:bg-ink/[0.04]',
                i < rows.length - 1 && 'border-b border-b-row',
                RAILS[tone],
              )}
              style={{ gridTemplateColumns: template }}
            >
              {columns.map((col) => (
                <span key={col.key} role="cell" className={cn('min-w-0', col.className)}>
                  {col.render(row)}
                </span>
              ))}

              {rowActions && (
                <span
                  className={cn(
                    'absolute inset-y-0 left-4 flex items-center gap-1 opacity-0',
                    'transition-opacity duration-micro ease-standard',
                    'group-hover:opacity-100 group-focus-within:opacity-100',
                  )}
                >
                  {rowActions(row)}
                </span>
              )}
            </div>
          )

          return linkTo ? (
            <Link key={row.id} to={linkTo(row)} className="block">
              {content}
            </Link>
          ) : (
            <div key={row.id}>{content}</div>
          )
        })}
      </div>
    </div>
  )
}

export function TableFooter({ shown, total, hint }: { shown: number; total: number; hint?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair px-7 py-4 text-[13.5px] text-ink-muted">
      <span className="numeric" dir="ltr">
        1—{shown} OF {total}
      </span>
      {hint && <span>{hint}</span>}
    </div>
  )
}

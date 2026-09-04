import { useState, type ReactNode } from 'react'
import { Bookmark, BookmarkPlus, Check, Columns3, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu'
import type { SavedView } from '@/lib/useTableViews'

const TRIGGER = cn(
  'inline-flex h-10 items-center gap-2 rounded-md border border-field bg-surface px-3',
  'text-[14px] text-ink-muted transition-colors duration-micro ease-standard',
  'hover:border-steel-600 hover:text-ink',
)

/** Which columns the table shows. Locked keys cannot be turned off. */
export function ColumnsMenu({
  columns,
  hidden,
  onToggle,
  onReset,
  locked = [],
}: {
  columns: { key: string; header: string }[]
  hidden: string[]
  onToggle: (key: string) => void
  onReset: () => void
  locked?: string[]
}) {
  return (
    <Menu
      label="עמודות"
      align="end"
      trigger={({ open }) => (
        <span className={cn(TRIGGER, open && 'border-steel-600 text-ink')}>
          <Columns3 className="size-4" />
          עמודות
          {hidden.length > 0 && (
            <span className="numeric text-[12px] text-steel-700" dir="ltr">
              {columns.length - hidden.length}/{columns.length}
            </span>
          )}
        </span>
      )}
    >
      {() => (
        <>
          <MenuLabel>עמודות מוצגות</MenuLabel>
          {columns.map((col) => {
            const isLocked = locked.includes(col.key)
            const shown = !hidden.includes(col.key)
            return (
              <MenuItem key={col.key} onClick={() => onToggle(col.key)} disabled={isLocked}>
                <span
                  aria-hidden
                  className={cn(
                    'flex size-[18px] shrink-0 items-center justify-center rounded-sm border',
                    shown ? 'border-steel-600 bg-steel-600 text-white' : 'border-field',
                  )}
                >
                  {shown && <Check className="size-3" />}
                </span>
                <span className="truncate">{col.header}</span>
                {isLocked && <span className="ms-auto text-[12px] text-ink-subtle">קבוע</span>}
              </MenuItem>
            )
          })}
          <MenuSeparator />
          <MenuItem onClick={onReset} disabled={hidden.length === 0}>
            החזרת כל העמודות
          </MenuItem>
        </>
      )}
    </Menu>
  )
}

/**
 * Saved views. A view is the current search, filters and sort under a name —
 * "התיקים החסומים שלי" is one click instead of three dropdowns every morning.
 */
export function SavedViewsMenu<S>({
  views,
  activeId,
  onApply,
  onSave,
  onDelete,
  dirty,
}: {
  views: SavedView<S>[]
  activeId: string | null
  onApply: (view: SavedView<S>) => void
  onSave: (name: string) => void
  onDelete: (id: string) => void
  /** True when the screen no longer matches the view it was loaded from. */
  dirty?: boolean
}) {
  const [name, setName] = useState('')
  const active = views.find((v) => v.id === activeId)

  return (
    <Menu
      label="תצוגות שמורות"
      align="end"
      width={288}
      trigger={({ open }) => (
        <span className={cn(TRIGGER, open && 'border-steel-600 text-ink')}>
          <Bookmark className={cn('size-4', active && 'fill-steel-600 text-steel-600')} />
          <span className="max-w-[140px] truncate">{active ? active.name : 'תצוגות'}</span>
          {active && dirty && <span className="text-[12px] text-ink-subtle">•</span>}
        </span>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>תצוגות שמורות</MenuLabel>
          {views.length === 0 ? (
            <p className="px-2.5 pb-2 text-[13px] text-ink-muted">
              עדיין לא שמרת תצוגה. סנן את הרשימה ושמור אותה בשם.
            </p>
          ) : (
            views.map((view) => (
              <div key={view.id} className="group/view flex items-center gap-1">
                <MenuItem
                  onClick={() => {
                    onApply(view)
                    close()
                  }}
                >
                  <Bookmark
                    className={cn(
                      'size-4 shrink-0',
                      view.id === activeId ? 'fill-steel-600 text-steel-600' : 'text-ink-subtle',
                    )}
                  />
                  <span className="truncate">{view.name}</span>
                </MenuItem>
                <button
                  type="button"
                  onClick={() => onDelete(view.id)}
                  aria-label={`מחיקת התצוגה ${view.name}`}
                  className="shrink-0 rounded p-1.5 text-ink-subtle transition-colors duration-micro hover:bg-urgent-tint hover:text-urgent-ink"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}

          <MenuSeparator />

          <form
            className="flex items-center gap-2 px-1 pb-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              onSave(name)
              setName('')
              close()
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם לתצוגה הנוכחית"
              aria-label="שם לתצוגה הנוכחית"
              className="h-9 min-w-0 flex-1 rounded-md border border-field bg-surface px-2.5 text-[13.5px] placeholder:text-ink-faint focus:border-steel-600"
            />
            <Button type="submit" size="sm" disabled={!name.trim()}>
              <BookmarkPlus className="size-4" />
              שמירה
            </Button>
          </form>
        </>
      )}
    </Menu>
  )
}

/**
 * The bulk bar. It only exists while something is selected, and it always says
 * how many rows it is about to touch — a bulk action must never be a surprise.
 */
export function BulkBar({
  count,
  onClear,
  busy,
  children,
}: {
  count: number
  onClear: () => void
  busy?: boolean
  children: ReactNode
}) {
  if (count === 0) return null

  return (
    <div
      role="region"
      aria-label="פעולות על שורות מסומנות"
      className={cn(
        'fixed bottom-[calc(150px+env(safe-area-inset-bottom))] z-40 md:bottom-6',
        'left-1/2 w-[min(720px,calc(100vw-2rem))] -translate-x-1/2',
        'flex flex-wrap items-center gap-3 rounded-lg border border-hair bg-surface',
        'px-4 py-3 shadow-modal animate-overlay-in',
      )}
    >
      <span className="text-[14px] font-medium text-ink">
        <span className="numeric" dir="ltr">
          {count}
        </span>{' '}
        {count === 1 ? 'שורה מסומנת' : 'שורות מסומנות'}
      </span>

      <span
        className={cn(
          'flex flex-wrap items-center gap-2',
          busy && 'pointer-events-none opacity-50',
        )}
      >
        {children}
      </span>

      <button
        type="button"
        onClick={onClear}
        className="ms-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13.5px] text-ink-muted transition-colors duration-micro hover:bg-ink/[0.05] hover:text-ink"
      >
        <X className="size-3.5" />
        ניקוי הבחירה
      </button>
    </div>
  )
}

/** A bulk action that sets one field across the selection. */
export function BulkSelect({
  label,
  options,
  onPick,
}: {
  label: string
  options: { value: string; label: string }[]
  onPick: (value: string) => void
}) {
  return (
    <select
      value=""
      aria-label={label}
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value)
        e.target.value = ''
      }}
      className={cn(
        'h-9 cursor-pointer rounded-md border border-field bg-surface px-2.5 text-[13.5px]',
        'text-ink-muted transition-colors duration-micro ease-standard focus:border-steel-600',
      )}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

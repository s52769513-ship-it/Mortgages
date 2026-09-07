import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

/** Kept clear of the window edge on every side. */
const EDGE = 8
/** Between the trigger and the panel. */
const GAP = 6

/**
 * A small anchored popover. Closes on Escape, on a click outside and when the
 * focus leaves it, so it never outlives the intent that opened it.
 *
 * The panel is portalled to the body and positioned against the trigger's
 * box rather than nested beside it. A menu inside a table would otherwise be
 * cut off at the card's edge — a scroll container clips on both axes, so the
 * last row's menu had nowhere to go — and it flips above the trigger when
 * the room below has run out.
 */
export function Menu({
  label,
  trigger,
  children,
  align = 'start',
  width = 264,
  className,
  triggerClassName,
}: {
  label: string
  trigger: (props: { open: boolean }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  width?: number
  className?: string
  /** For a trigger that has to fill its container — a table cell, say. */
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<{ top: number; left: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node
      // The panel lives outside this subtree now, so it has to be asked
      // separately — otherwise pressing an item counts as an outside click
      // and unmounts it before the click can land.
      if (root.current?.contains(t) || panel.current?.contains(t)) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Before paint, so the panel is never seen at an unplaced position.
  useLayoutEffect(() => {
    if (!open) {
      setBox(null)
      return
    }

    const place = () => {
      const anchor = root.current?.getBoundingClientRect()
      const el = panel.current
      if (!anchor || !el) return

      const height = el.offsetHeight
      const below = window.innerHeight - anchor.bottom
      const above = anchor.top
      // Flip only when below has genuinely run out and above is roomier.
      const up = below < height + GAP + EDGE && above > below
      const top = up
        ? Math.max(EDGE, anchor.top - GAP - height)
        : Math.min(anchor.bottom + GAP, window.innerHeight - height - EDGE)

      const rtl = getComputedStyle(el).direction === 'rtl'
      const startEdge = align === 'start' ? (rtl ? anchor.right - width : anchor.left) : rtl ? anchor.left : anchor.right - width
      const left = Math.min(Math.max(EDGE, startEdge), window.innerWidth - width - EDGE)

      setBox({ top, left })
    }

    place()
    // Capture, so a scroll of the table under it repositions too.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, align, width])

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={triggerClassName}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger({ open })}
      </button>

      {open &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            style={{
              width,
              top: box?.top ?? 0,
              left: box?.left ?? 0,
              visibility: box ? 'visible' : 'hidden',
            }}
            className={cn(
              // Above a modal (z-50) it may have been opened from, below a
              // toast (z-60), which must stay readable over everything.
              'fixed z-[55] rounded-lg border border-hair bg-surface p-1.5',
              'shadow-raised animate-overlay-in',
            )}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </div>
  )
}

export function MenuItem({
  onClick,
  children,
  tone = 'default',
  disabled,
}: {
  onClick: () => void
  children: ReactNode
  tone?: 'default' | 'danger'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-[14px]',
        'transition-colors duration-micro ease-standard disabled:opacity-45',
        tone === 'danger'
          ? 'text-urgent-ink enabled:hover:bg-urgent-tint'
          : 'text-ink enabled:hover:bg-ink/[0.05]',
      )}
    >
      {children}
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="eyebrow px-2.5 pb-1 pt-2 text-[11px] font-semibold text-ink-subtle">{children}</p>
  )
}

export function MenuSeparator() {
  return <div className="my-1.5 border-t border-hair" />
}

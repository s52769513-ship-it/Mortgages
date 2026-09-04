import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * A small anchored popover. Closes on Escape, on a click outside and when the
 * focus leaves it, so it never outlives the intent that opened it.
 */
export function Menu({
  label,
  trigger,
  children,
  align = 'start',
  width = 264,
  className,
}: {
  label: string
  trigger: (props: { open: boolean }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  width?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
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

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger({ open })}
      </button>

      {open && (
        <div
          role="menu"
          style={{ width }}
          className={cn(
            'absolute top-[calc(100%+6px)] z-40 rounded-lg border border-hair bg-surface p-1.5',
            'shadow-raised animate-overlay-in',
            align === 'start' ? 'start-0' : 'end-0',
          )}
        >
          {children(() => setOpen(false))}
        </div>
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

import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Level-3 overlay. Focus is trapped inside, Esc closes it, and focus returns
 * to whatever opened it — accessibility rule 06.
 */
export function Modal({
  open,
  onClose,
  eyebrow,
  title,
  description,
  footer,
  size = 'md',
  children,
}: {
  open: boolean
  onClose: () => void
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (nodes.length === 0) return

    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  useEffect(() => {
    if (!open) return

    openerRef.current = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      trapFocus(e)
    }
    document.addEventListener('keydown', onKey)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      openerRef.current?.focus()
    }
  }, [open, onClose, trapFocus])

  if (!open) return null

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-4xl' }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-steel-900/40 animate-fade-in" onClick={onClose} aria-hidden />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[86vh] w-full flex-col overflow-hidden',
          'rounded-xl bg-surface shadow-modal animate-overlay-in',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hair px-7 py-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="eyebrow mb-1 text-[12px] text-steel-600" dir="ltr">
                {eyebrow}
              </p>
            )}
            <h2 className="font-heading text-[20px] font-medium text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="סגירה"
            className="shrink-0 rounded-md p-1.5 text-ink-muted transition-colors duration-micro hover:bg-ink/[0.04] hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3.5 border-t border-hair px-7 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

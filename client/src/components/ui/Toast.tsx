import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error' | 'info'
type ToastAction = { label: string; onClick: () => void }
type Toast = { id: number; tone: ToastTone; title: string; detail?: string; action?: ToastAction }

const MAX_VISIBLE = 3
const DISMISS_MS = 4000

const ToastContext = createContext<{
  notify: (title: string, options?: { tone?: ToastTone; detail?: string; action?: ToastAction }) => void
} | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const STYLES: Record<ToastTone, { rail: string; chip: string; icon: ReactNode }> = {
  success: {
    rail: 'border-s-ok',
    chip: 'bg-ok-tint text-ok',
    icon: <CheckCircle2 className="size-5" />,
  },
  error: {
    rail: 'border-s-urgent',
    chip: 'bg-urgent-tint text-urgent',
    icon: <AlertTriangle className="size-5" />,
  },
  info: {
    rail: 'border-s-busy',
    chip: 'bg-busy-tint text-busy',
    icon: <Info className="size-5" />,
  },
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  // An error stays until it is dismissed by hand; the rest time out.
  useEffect(() => {
    if (toast.tone === 'error') return
    const timer = setTimeout(() => onDismiss(toast.id), DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toast.id, toast.tone, onDismiss])

  const style = STYLES[toast.tone]

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border-s-[5px] bg-surface p-3.5 shadow-modal',
        'animate-overlay-in',
        style.rail,
      )}
    >
      <span
        className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', style.chip)}
        aria-hidden
      >
        {style.icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug text-ink">{toast.title}</p>
        {toast.detail && <p className="mt-0.5 text-[13px] text-ink-muted">{toast.detail}</p>}
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick()
              onDismiss(toast.id)
            }}
            className="mt-1 text-[13px] font-medium text-steel-700 underline underline-offset-[3px]"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="סגירה"
        className="ms-auto shrink-0 rounded p-0.5 text-ink-subtle transition-colors duration-micro hover:text-ink"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (
      title: string,
      { tone = 'success', detail, action }: { tone?: ToastTone; detail?: string; action?: ToastAction } = {},
    ) => {
      setToasts((prev) =>
        [...prev, { id: Date.now() + Math.random(), tone, title, detail, action }].slice(-MAX_VISIBLE),
      )
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 left-6 z-[60] flex w-[340px] flex-col gap-3"
        >
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

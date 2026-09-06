import { useEffect, useState, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'

/**
 * Asks twice before deleting something that cannot be brought back.
 *
 * The first step is the one that matters: it says in plain words what else
 * goes with the record, because nobody can be expected to remember what hangs
 * off a file. The second step is a copy of the record's own name — a click
 * can be a slip of the hand, typing a file number cannot.
 */

export function ConfirmDelete({
  open,
  onClose,
  onConfirm,
  pending = false,
  title,
  /** The exact text that has to be typed — the record's own name or number. */
  phrase,
  /** What that text is, so the instruction can name it. */
  phraseLabel,
  /** What is about to be lost, beyond the record itself. */
  children,
  confirmLabel = 'מחק לצמיתות',
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  pending?: boolean
  title: string
  phrase: string
  phraseLabel: string
  children: ReactNode
  confirmLabel?: string
}) {
  const [step, setStep] = useState<'warn' | 'confirm'>('warn')
  const [typed, setTyped] = useState('')

  // Reopening starts from the beginning; the last attempt is never carried in.
  useEffect(() => {
    if (open) {
      setStep('warn')
      setTyped('')
    }
  }, [open])

  const matches = typed.trim() === phrase.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description={step === 'warn' ? 'הפעולה אינה הפיכה.' : 'אישור אחרון.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          {step === 'warn' ? (
            <Button variant="danger" onClick={() => setStep('confirm')}>
              הבנתי, המשך
            </Button>
          ) : (
            <Button
              variant="danger"
              disabled={!matches}
              loading={pending}
              loadingLabel="מוחק…"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          )}
        </>
      }
    >
      {step === 'warn' ? (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-md bg-urgent-tint px-4 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-urgent-ink" />
            <div className="space-y-2 text-[14px] leading-relaxed text-ink">{children}</div>
          </div>
          <p className="text-[13px] text-ink-muted">
            אין שחזור. אם אין ודאות מלאה — עדיף לסגור את החלון.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[14px] leading-relaxed text-ink">
            כדי לאשר, הקלד את {phraseLabel}:{' '}
            <span className="font-semibold" dir="auto">
              {phrase}
            </span>
          </p>
          <Input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={phrase}
            aria-label={`הקלד ${phraseLabel} לאישור`}
            dir="auto"
          />
          {typed.length > 0 && !matches && (
            <p className="text-[12.5px] text-ink-muted">הטקסט אינו זהה עדיין.</p>
          )}
        </div>
      )}
    </Modal>
  )
}

import { useState } from 'react'
import { Check, Download, FileText, Printer, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { MortgageFile } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

/** What can be folded into the single PDF. Must match the server's list. */
const MERGEABLE = ['.pdf', '.png', '.jpg', '.jpeg']

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

/**
 * Shows what is about to leave the office before it does. Walking into a bank
 * to find a document missing is the failure worth preventing here, so the list
 * says plainly which files travel inside the PDF and which have to be sent on
 * their own.
 */
export function BankPackageModal({ file, onClose }: { file: MortgageFile; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false)

  const documents = file.documents ?? []
  const withFiles = documents.filter((doc) => doc.storagePath)
  const marked = withFiles.filter((doc) => doc.allowedForBank)
  const chosen = marked.length ? marked : withFiles

  const attachable = chosen.filter((doc) =>
    MERGEABLE.includes(extensionOf(doc.storagePath ?? '')),
  )
  const separate = chosen.filter(
    (doc) => !MERGEABLE.includes(extensionOf(doc.storagePath ?? '')),
  )

  const print = () => window.open(`/files/${file.id}/print`, '_blank', 'noopener')

  // A plain navigation, so the session cookie carries it — a download cannot
  // send an Authorization header.
  const download = () => {
    setDownloading(true)
    window.location.assign(`/api/files/${file.id}/package`)
    setTimeout(() => setDownloading(false), 4000)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="תיק לבנק"
      description="סיכום התיק והמסמכים בקובץ אחד, מוכן להגשה."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={print}>
            <Printer className="size-4" />
            הדפס סיכום
          </Button>
          <Button onClick={download} loading={downloading} loadingLabel="מכין…">
            <Download className="size-4" />
            הורד קובץ מלא
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-[14px] leading-relaxed text-ink-muted">
          הקובץ המלא נפתח בדף סיכום — הלקוח, העסקה, המימון, הבנקים ואנשי המקצוע — ואחריו
          המסמכים עצמם.
        </p>

        {!chosen.length ? (
          <p className="rounded-md bg-wait-tint px-4 py-3 text-[13.5px] text-wait-ink">
            אין בתיק מסמכים עם קובץ מצורף. הקובץ יכיל את דף הסיכום בלבד.
          </p>
        ) : (
          <>
            {!marked.length && (
              <p className="rounded-md bg-wait-tint px-4 py-3 text-[13.5px] text-wait-ink">
                לא סומנו מסמכים לחבילת הבנק, ולכן יצורפו כל המסמכים שיש להם קובץ. אפשר לסמן
                מסמכים ספציפיים בעריכת המסמך.
              </p>
            )}

            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-ink-muted">
                יצורפו לקובץ ({attachable.length})
              </h3>
              <ul className="divide-y divide-row rounded-md border border-row">
                {attachable.map((doc) => (
                  <Row key={doc.id} seq={doc.seq} name={doc.docType} tone="ok" />
                ))}
                {!attachable.length && (
                  <li className="px-4 py-3 text-[13.5px] text-ink-muted">אין מסמכים לצירוף.</li>
                )}
              </ul>
            </section>

            {separate.length > 0 && (
              <section>
                <h3 className="mb-2 text-[13px] font-semibold text-ink-muted">
                  יש לשלוח בנפרד ({separate.length})
                </h3>
                <ul className="divide-y divide-row rounded-md border border-row">
                  {separate.map((doc) => (
                    <Row
                      key={doc.id}
                      seq={doc.seq}
                      name={doc.docType}
                      tone="wait"
                      hint={extensionOf(doc.storagePath ?? '') || 'סוג לא מזוהה'}
                    />
                  ))}
                </ul>
                <p className="mt-2 text-[12.5px] text-ink-subtle">
                  קבצים שאינם PDF או תמונה אינם ניתנים לאיחוד. הם מופיעים ברשימה בסוף הקובץ.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

function Row({
  seq,
  name,
  tone,
  hint,
}: {
  seq: number
  name: string
  tone: 'ok' | 'wait'
  hint?: string
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full',
          tone === 'ok' ? 'bg-ok-tint text-ok-ink' : 'bg-wait-tint text-wait-ink',
        )}
      >
        {tone === 'ok' ? <Check className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
      </span>
      <span className="numeric text-[12.5px] text-ink-subtle" dir="ltr">
        {seq}
      </span>
      <FileText className="size-4 shrink-0 text-ink-subtle" />
      <span className="min-w-0 flex-1 truncate text-[14px]">{name}</span>
      {hint && (
        <span className="shrink-0 text-[12.5px] text-ink-subtle" dir="ltr">
          {hint}
        </span>
      )}
    </li>
  )
}

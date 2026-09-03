import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Paperclip, X } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'
import { DOCUMENT_STATUS, options } from '@/lib/labels'
import type { Doc } from '@/types'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`

/**
 * Records a document and, when there is one, uploads the file with it. A
 * document can also be recorded before it arrives — that is what the
 * "required" and "requested" statuses are for.
 */
export function UploadDocumentModal({
  fileId,
  open,
  onClose,
}: {
  fileId: string
  open: boolean
  onClose: () => void
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    docType: '',
    periodLabel: '',
    expiresAt: '',
    status: 'RECEIVED',
    notes: '',
    allowedForBank: false,
  })
  const [file, setFile] = useState<File | null>(null)
  const [touched, setTouched] = useState(false)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const create = useMutation({
    mutationFn: async () => {
      const document = await api.post<Doc>('/documents', {
        fileId,
        docType: form.docType.trim(),
        periodLabel: form.periodLabel.trim() || null,
        expiresAt: form.expiresAt || null,
        // Uploading sets the status itself, so only send it when there is no file.
        ...(file ? {} : { status: form.status }),
        notes: form.notes.trim() || null,
        allowedForBank: form.allowedForBank,
        fileName: file?.name ?? '',
      })

      if (!file) return document

      const body = new FormData()
      body.append('file', file, file.name)
      return api.upload<Doc>(`/documents/${document.id}/file`, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify(file ? 'המסמך הועלה' : 'המסמך נרשם כנדרש')
      onClose()
    },
    onError: (e: Error) => notify('העלאת המסמך נכשלה', { tone: 'error', detail: e.message }),
  })

  const missingType = form.docType.trim().length < 2

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (missingType) return
    create.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="מסמך חדש"
      description="אפשר לצרף קובץ עכשיו, או לרשום מסמך שעדיין ממתין ללקוח."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="new-document" type="submit" loading={create.isPending} loadingLabel="מעלה…">
            שמור
          </Button>
        </>
      }
    >
      <form id="new-document" onSubmit={submit} className="space-y-5">
        <Input
          label="סוג המסמך"
          required
          hint="תלושי שכר, נסח טאבו, אישור הון עצמי…"
          value={form.docType}
          onChange={(e) => set('docType', e.target.value)}
          error={touched && missingType ? 'נדרש סוג מסמך' : undefined}
        />

        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-ink-muted">קובץ</span>
          {file ? (
            <div className="flex items-center gap-2.5 rounded-md border border-field bg-surface px-3 py-2.5">
              <FileText className="size-4 shrink-0 text-ink-subtle" />
              <span className="min-w-0 flex-1 truncate text-[14px]">{file.name}</span>
              <span className="numeric shrink-0 text-[12.5px] text-ink-subtle" dir="ltr">
                {formatSize(file.size)}
              </span>
              <button type="button" onClick={() => setFile(null)} aria-label="הסרת הקובץ">
                <X className="size-4 text-ink-subtle hover:text-ink" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-field',
                'px-3 py-5 text-[14px] text-ink-muted',
                'transition-colors duration-micro ease-standard hover:border-steel-600 hover:text-ink',
              )}
            >
              <Paperclip className="size-4" />
              בחר קובץ להעלאה
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="תקופה שאליה מתייחס"
            hint="למשל: 3 חודשים אחרונים"
            value={form.periodLabel}
            onChange={(e) => set('periodLabel', e.target.value)}
          />
          <Input
            label="תאריך תפוגה"
            type="date"
            dir="ltr"
            value={form.expiresAt}
            onChange={(e) => set('expiresAt', e.target.value)}
          />
          {!file && (
            <Select
              label="סטטוס"
              options={options(DOCUMENT_STATUS)}
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            />
          )}
        </div>

        <Textarea
          label="הערות"
          rows={2}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />

        <Checkbox
          label="מותר לצרף לחבילת המסמכים לבנק"
          checked={form.allowedForBank}
          onChange={(e) => set('allowedForBank', e.target.checked)}
        />
      </form>
    </Modal>
  )
}

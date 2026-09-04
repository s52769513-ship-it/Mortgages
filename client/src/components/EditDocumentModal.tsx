import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { DOCUMENT_STATUS, options } from '@/lib/labels'
import type { Doc } from '@/types'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

const toDateInput = (value: string | null | undefined) => (value ? value.slice(0, 10) : '')

/**
 * A document keeps changing after it is filed: it expires, it turns out to be
 * the wrong period, it comes back from the bank as unusable. The list can only
 * move its status, so everything else is corrected here.
 */
export function EditDocumentModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const { notify } = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    docType: doc.docType,
    status: doc.status,
    periodLabel: doc.periodLabel ?? '',
    receivedAt: toDateInput(doc.receivedAt),
    expiresAt: toDateInput(doc.expiresAt),
    issueNotes: doc.issueNotes ?? '',
    source: doc.source ?? '',
    notes: doc.notes ?? '',
    allowedForBank: doc.allowedForBank,
    isValid: doc.isValid,
  })
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    setForm({
      docType: doc.docType,
      status: doc.status,
      periodLabel: doc.periodLabel ?? '',
      receivedAt: toDateInput(doc.receivedAt),
      expiresAt: toDateInput(doc.expiresAt),
      issueNotes: doc.issueNotes ?? '',
      source: doc.source ?? '',
      notes: doc.notes ?? '',
      allowedForBank: doc.allowedForBank,
      isValid: doc.isValid,
    })
    setTouched(false)
  }, [doc])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const save = useMutation({
    mutationFn: () =>
      api.patch<Doc>(`/documents/${doc.id}`, {
        docType: form.docType.trim(),
        status: form.status,
        periodLabel: form.periodLabel.trim() || null,
        receivedAt: form.receivedAt || null,
        expiresAt: form.expiresAt || null,
        issueNotes: form.issueNotes.trim() || null,
        source: form.source.trim() || null,
        notes: form.notes.trim() || null,
        allowedForBank: form.allowedForBank,
        isValid: form.isValid,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['file'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify('המסמך עודכן', { detail: updated.docType })
      onClose()
    },
    onError: (e: Error) => notify('עדכון המסמך נכשל', { tone: 'error', detail: e.message }),
  })

  const missingType = form.docType.trim().length < 2

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (missingType) return
    save.mutate()
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={`#${doc.seq}`}
      title="פרטי המסמך"
      description={doc.fileName || undefined}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="edit-document" type="submit" loading={save.isPending}>
            שמור שינויים
          </Button>
        </>
      }
    >
      <form id="edit-document" onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="סוג המסמך"
            required
            value={form.docType}
            onChange={(e) => set('docType', e.target.value)}
            error={touched && missingType ? 'נדרש סוג מסמך' : undefined}
          />
          <Select
            label="סטטוס"
            options={options(DOCUMENT_STATUS)}
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
          />
          <Input
            label="תקופה"
            hint="למשל: 3 חודשים אחרונים"
            value={form.periodLabel}
            onChange={(e) => set('periodLabel', e.target.value)}
          />
          <Input
            label="מקור המסמך"
            hint="מי מסר אותו"
            value={form.source}
            onChange={(e) => set('source', e.target.value)}
          />
          <Input
            label="תאריך קבלה"
            type="date"
            dir="ltr"
            value={form.receivedAt}
            onChange={(e) => set('receivedAt', e.target.value)}
          />
          <Input
            label="תאריך תפוגה"
            type="date"
            dir="ltr"
            value={form.expiresAt}
            onChange={(e) => set('expiresAt', e.target.value)}
          />
        </div>

        <Textarea
          label="מה חסר או לא תקין"
          rows={2}
          value={form.issueNotes}
          onChange={(e) => set('issueNotes', e.target.value)}
        />

        <Textarea
          label="הערות"
          rows={2}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox
            label="המסמך תקין"
            checked={form.isValid === true}
            onChange={(e) => set('isValid', e.target.checked ? true : false)}
          />
          <Checkbox
            label="מותר לחבילת הבנק"
            checked={form.allowedForBank}
            onChange={(e) => set('allowedForBank', e.target.checked)}
          />
        </div>
      </form>
    </Modal>
  )
}

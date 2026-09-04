import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { BANK_APP_STATUS, options } from '@/lib/labels'
import type { BankApplication } from '@/types'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

type Picked = { id: string | null; text: string }

const BLANK = {
  bank: { id: null, text: '' } as Picked,
  branch: { id: null, text: '' } as Picked,
  banker: { id: null, text: '' } as Picked,
  bankerPhone: '',
  managerName: '',
  status: 'SUBMITTED',
  submittedAt: '',
  submissionMethod: '',
  requestedAmount: '',
  ltvPercent: '',
  offeredRates: '',
  mixNotes: '',
  missingItems: '',
  creditCheck: '',
  approvalInPrinciple: false,
  approvalDate: '',
  approvalValidUntil: '',
  fileOpened: false,
  collateralReceived: false,
  sentToReview: false,
  sentToExecution: false,
  executedAt: '',
  rejectionReason: '',
}

/** A date input wants YYYY-MM-DD; the server speaks full ISO. */
const toDateInput = (value: string | null | undefined) => (value ? value.slice(0, 10) : '')

function formOf(application: BankApplication): typeof BLANK {
  return {
    bank: { id: application.bank?.id ?? null, text: application.bank?.name ?? '' },
    branch: { id: application.branch?.id ?? null, text: application.branch?.name ?? '' },
    banker: { id: application.banker?.id ?? null, text: application.banker?.name ?? '' },
    bankerPhone: application.banker?.phone ?? '',
    managerName: application.managerName ?? '',
    status: application.status,
    submittedAt: toDateInput(application.submittedAt),
    submissionMethod: application.submissionMethod ?? '',
    requestedAmount: application.requestedAmount ?? '',
    ltvPercent: application.ltvPercent ?? '',
    offeredRates: application.offeredRates ?? '',
    mixNotes: application.mixNotes ?? '',
    missingItems: application.missingItems ?? '',
    creditCheck: application.creditCheck ?? '',
    approvalInPrinciple: application.approvalInPrinciple,
    approvalDate: toDateInput(application.approvalDate),
    approvalValidUntil: toDateInput(application.approvalValidUntil),
    fileOpened: application.fileOpened,
    collateralReceived: application.collateralReceived,
    sentToReview: application.sentToReview,
    sentToExecution: application.sentToExecution,
    executedAt: toDateInput(application.executedAt),
    rejectionReason: application.rejectionReason ?? '',
  }
}

/**
 * Opens a separate application per bank, which is what makes the offers
 * comparable side by side on the file page. The same form reopens an existing
 * application, because most of what a bank application records — an approval,
 * its validity, a rejection — only becomes known after it was filed.
 */
export function BankApplicationModal({
  fileId,
  application,
  open,
  onClose,
}: {
  fileId: string
  /** Editing an existing application rather than opening a new one. */
  application?: BankApplication | null
  open: boolean
  onClose: () => void
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(BLANK)
  const [touched, setTouched] = useState(false)
  const editing = Boolean(application)

  // Reopening the form on a different record has to show that record.
  useEffect(() => {
    if (!open) return
    setForm(application ? formOf(application) : BLANK)
    setTouched(false)
  }, [open, application])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const payload = () => ({
    bankName: form.bank.text.trim(),
    // The label carries the city for readability; send the branch's own name.
    branchName: form.branch.text.split(' · ')[0].trim() || null,
    bankerName: form.banker.text.trim() || null,
    bankerPhone: form.bankerPhone.trim() || null,
    managerName: form.managerName.trim() || null,
    status: form.status,
    submittedAt: form.submittedAt || null,
    submissionMethod: form.submissionMethod.trim() || null,
    requestedAmount: form.requestedAmount || null,
    ltvPercent: form.ltvPercent || null,
    offeredRates: form.offeredRates.trim() || null,
    mixNotes: form.mixNotes.trim() || null,
    missingItems: form.missingItems.trim() || null,
    creditCheck: form.creditCheck.trim() || null,
    approvalInPrinciple: form.approvalInPrinciple,
    approvalDate: form.approvalDate || null,
    approvalValidUntil: form.approvalValidUntil || null,
    fileOpened: form.fileOpened,
    collateralReceived: form.collateralReceived,
    sentToReview: form.sentToReview,
    sentToExecution: form.sentToExecution,
    executedAt: form.executedAt || null,
    rejectionReason: form.rejectionReason.trim() || null,
  })

  const save = useMutation({
    mutationFn: () =>
      application
        ? api.patch<BankApplication>(`/bank-applications/${application.id}`, payload())
        : api.post<BankApplication>('/bank-applications', { fileId, ...payload() }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] })
      queryClient.invalidateQueries({ queryKey: ['bank-applications'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify(editing ? 'הבקשה עודכנה' : 'הבקשה נוצרה', { detail: saved.bank?.name })
      setForm(BLANK)
      setTouched(false)
      onClose()
    },
    onError: (e: Error) =>
      notify(editing ? 'עדכון הבקשה נכשל' : 'יצירת הבקשה נכשלה', {
        tone: 'error',
        detail: e.message,
      }),
  })

  const missingBank = !form.bank.text.trim()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (missingBank) return
    save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={application ? `#${application.seq}` : undefined}
      title={editing ? 'בקשה לבנק' : 'בקשה חדשה לבנק'}
      description={
        editing
          ? 'עדכון הבקשה — סטטוס, אישור עקרוני, תוקף וכל מה שהתחדש מאז ההגשה.'
          : 'בנק וסניף נבחרים מהרשימה הרשמית. בנקאי שאינו ברשימה נשמר בהקלדה ויופיע בפעם הבאה.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="bank-app-form" type="submit" loading={save.isPending}>
            {editing ? 'שמור שינויים' : 'צור בקשה'}
          </Button>
        </>
      }
    >
      <form id="bank-app-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Combobox
            label="בנק"
            required
            endpoint="/banks"
            placeholder="הקלד או בחר בנק…"
            value={form.bank}
            onChange={(bank) => {
              set('bank', bank)
              // A branch belongs to one bank, so changing the bank clears it.
              set('branch', { id: null, text: '' })
              set('banker', { id: null, text: '' })
            }}
            error={touched && missingBank ? 'נדרש לבחור או להקליד בנק' : undefined}
          />

          <Combobox
            label="סניף"
            endpoint={form.bank.id ? `/banks/${form.bank.id}/branches` : null}
            disabled={!form.bank.id}
            disabledHint={
              form.bank.text.trim()
                ? 'הבנק אינו ברשימה, כך שאין לו סניפים לבחור מהם — אפשר להשלים אחר כך.'
                : 'בחר בנק כדי לראות את הסניפים שלו.'
            }
            placeholder="מספר סניף, שם או עיר…"
            value={form.branch}
            onChange={(branch) => {
              set('branch', branch)
              set('banker', { id: null, text: '' })
            }}
          />

          <Combobox
            label="בנקאי"
            endpoint={form.branch.id ? `/banks/branches/${form.branch.id}/bankers` : null}
            placeholder="שם הבנקאי…"
            hint="לא ברשימה? הקלד — הוא יישמר לפעם הבאה."
            value={form.banker}
            onChange={(banker) => set('banker', banker)}
          />

          <Input
            label="טלפון הבנקאי"
            dir="ltr"
            className="numeric"
            value={form.bankerPhone}
            onChange={(e) => set('bankerPhone', e.target.value)}
          />

          <Input
            label="שם מנהל הסניף"
            hint="אם רלוונטי"
            value={form.managerName}
            onChange={(e) => set('managerName', e.target.value)}
          />

          <Select
            label="סטטוס הבקשה"
            options={options(BANK_APP_STATUS)}
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
          />

          <Input
            label="תאריך הגשה"
            type="date"
            dir="ltr"
            value={form.submittedAt}
            onChange={(e) => set('submittedAt', e.target.value)}
          />

          <Input
            label="אופן ההגשה"
            hint="פורטל, מייל, פגישה"
            value={form.submissionMethod}
            onChange={(e) => set('submissionMethod', e.target.value)}
          />

          <Input
            label="סכום מבוקש"
            type="number"
            dir="ltr"
            className="numeric"
            value={form.requestedAmount}
            onChange={(e) => set('requestedAmount', e.target.value)}
          />

          <Input
            label="אחוז מימון"
            type="number"
            step="0.01"
            dir="ltr"
            className="numeric"
            value={form.ltvPercent}
            onChange={(e) => set('ltvPercent', e.target.value)}
          />
        </div>

        <Input
          label="ריביות מוצעות"
          hint="למשל: 4.9% · מסלול קבוע"
          value={form.offeredRates}
          onChange={(e) => set('offeredRates', e.target.value)}
        />

        <Textarea
          label="תמהיל"
          rows={2}
          value={form.mixNotes}
          onChange={(e) => set('mixNotes', e.target.value)}
        />

        <Textarea
          label="רשימת חוסרים"
          rows={2}
          value={form.missingItems}
          onChange={(e) => set('missingItems', e.target.value)}
        />

        {/* What happens to a bank application after it is filed. Kept out of the
            new-application form, where none of it can be known yet. */}
        {editing && (
          <div className="space-y-5 border-t border-hair pt-5">
            <h3 className="text-[13px] font-semibold text-ink-muted">מהגשה ועד ביצוע</h3>

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="חיווי אשראי"
                value={form.creditCheck}
                onChange={(e) => set('creditCheck', e.target.value)}
              />
              <Input
                label="תאריך האישור"
                type="date"
                dir="ltr"
                value={form.approvalDate}
                onChange={(e) => set('approvalDate', e.target.value)}
              />
              <Input
                label="תוקף האישור"
                type="date"
                dir="ltr"
                value={form.approvalValidUntil}
                onChange={(e) => set('approvalValidUntil', e.target.value)}
              />
              <Input
                label="תאריך ביצוע"
                type="date"
                dir="ltr"
                value={form.executedAt}
                onChange={(e) => set('executedAt', e.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Checkbox
                label="אישור עקרוני"
                checked={form.approvalInPrinciple}
                onChange={(e) => set('approvalInPrinciple', e.target.checked)}
              />
              <Checkbox
                label="נפתח תיק"
                checked={form.fileOpened}
                onChange={(e) => set('fileOpened', e.target.checked)}
              />
              <Checkbox
                label="התקבלו בטחונות"
                checked={form.collateralReceived}
                onChange={(e) => set('collateralReceived', e.target.checked)}
              />
              <Checkbox
                label="הועבר לבחינה"
                checked={form.sentToReview}
                onChange={(e) => set('sentToReview', e.target.checked)}
              />
              <Checkbox
                label="הועבר לביצוע"
                checked={form.sentToExecution}
                onChange={(e) => set('sentToExecution', e.target.checked)}
              />
            </div>

            <Textarea
              label="סיבת דחייה או עיכוב"
              rows={2}
              value={form.rejectionReason}
              onChange={(e) => set('rejectionReason', e.target.value)}
            />
          </div>
        )}
      </form>
    </Modal>
  )
}

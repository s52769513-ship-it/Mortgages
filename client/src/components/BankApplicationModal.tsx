import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { BANK_APP_STATUS, options } from '@/lib/labels'
import type { BankApplication } from '@/types'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { Input, Select, Textarea } from '@/components/ui/Field'
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
}

/**
 * Opens a separate application per bank, which is what makes the offers
 * comparable side by side on the file page.
 */
export function BankApplicationModal({
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
  const [form, setForm] = useState(BLANK)
  const [touched, setTouched] = useState(false)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const create = useMutation({
    mutationFn: () =>
      api.post<BankApplication>('/bank-applications', {
        fileId,
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
      }),
    onSuccess: (application) => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] })
      queryClient.invalidateQueries({ queryKey: ['bank-applications'] })
      notify('הבקשה נוצרה', { detail: application.bank?.name })
      setForm(BLANK)
      setTouched(false)
      onClose()
    },
    onError: (e: Error) => notify('יצירת הבקשה נכשלה', { tone: 'error', detail: e.message }),
  })

  const missingBank = !form.bank.text.trim()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (missingBank) return
    create.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="בקשה חדשה לבנק"
      description="בנק וסניף נבחרים מהרשימה הרשמית. בנקאי שאינו ברשימה נשמר בהקלדה ויופיע בפעם הבאה."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="new-bank-app" type="submit" loading={create.isPending}>
            צור בקשה
          </Button>
        </>
      }
    >
      <form id="new-bank-app" onSubmit={submit} className="space-y-5">
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
      </form>
    </Modal>
  )
}

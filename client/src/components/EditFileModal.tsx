import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { FILE_STAGE, FILE_STATUS, options, URGENCY } from '@/lib/labels'
import type { Employee, MortgageFile } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

/** Trims a stored date to what <input type="date"> expects. */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
const toNumberInput = (value: string | null) => (value === null ? '' : String(Number(value)))

export function EditFileModal({
  file,
  open,
  onClose,
}: {
  file: MortgageFile
  open: boolean
  onClose: () => void
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    ownerId: file.ownerId ?? '',
    stage: file.stage,
    status: file.status,
    urgency: file.urgency,
    dealType: file.dealType ?? '',
    propertyType: file.propertyType ?? '',
    propertyAddress: file.propertyAddress ?? '',
    purchasePrice: toNumberInput(file.purchasePrice),
    propertyValue: toNumberInput(file.propertyValue),
    requestedAmount: toNumberInput(file.requestedAmount),
    ltvPercent: toNumberInput(file.ltvPercent),
    equity: toNumberInput(file.equity),
    desiredMonthly: toNumberInput(file.desiredMonthly),
    requiredIncome: toNumberInput(file.requiredIncome),
    borrowersIncome: toNumberInput(file.borrowersIncome),
    agencyFee: toNumberInput(file.agencyFee),
    existingLiabilities: file.existingLiabilities ?? '',
    nextPaymentDate: toDateInput(file.nextPaymentDate),
    executionDeadline: toDateInput(file.executionDeadline),
    blockReason: file.blockReason ?? '',
    lastAction: file.lastAction ?? '',
    nextAction: file.nextAction ?? '',
    nextActionDate: toDateInput(file.nextActionDate),
  })

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees'),
    enabled: open,
  })

  const save = useMutation({
    mutationFn: () => {
      // Empty boxes clear the field rather than writing an empty string.
      const orNull = (v: string) => (v.trim() === '' ? null : v.trim())
      return api.patch<MortgageFile>(`/files/${file.id}`, {
        ownerId: form.ownerId || null,
        stage: form.stage,
        status: form.status,
        urgency: form.urgency,
        dealType: orNull(form.dealType),
        propertyType: orNull(form.propertyType),
        propertyAddress: orNull(form.propertyAddress),
        purchasePrice: orNull(form.purchasePrice),
        propertyValue: orNull(form.propertyValue),
        requestedAmount: orNull(form.requestedAmount),
        ltvPercent: orNull(form.ltvPercent),
        equity: orNull(form.equity),
        desiredMonthly: orNull(form.desiredMonthly),
        requiredIncome: orNull(form.requiredIncome),
        borrowersIncome: orNull(form.borrowersIncome),
        agencyFee: orNull(form.agencyFee),
        existingLiabilities: orNull(form.existingLiabilities),
        nextPaymentDate: orNull(form.nextPaymentDate),
        executionDeadline: orNull(form.executionDeadline),
        blockReason: orNull(form.blockReason),
        lastAction: orNull(form.lastAction),
        nextAction: orNull(form.nextAction),
        nextActionDate: orNull(form.nextActionDate),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', file.id] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify('התיק עודכן')
      onClose()
    },
    onError: (e: Error) => notify('העדכון נכשל', { tone: 'error', detail: e.message }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  const money = (label: string, key: keyof typeof form) => (
    <Input
      label={label}
      type="number"
      dir="ltr"
      className="numeric"
      value={form[key]}
      onChange={(e) => set(key, e.target.value)}
    />
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`File ${file.fileNumber}`}
      title="עריכת התיק"
      description="כל שינוי נרשם ביומן הפעילות עם הערך הקודם והחדש."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="edit-file" type="submit" loading={save.isPending}>
            שמור
          </Button>
        </>
      }
    >
      <form id="edit-file" onSubmit={submit} className="space-y-6">
        <section className="space-y-5">
          <h3 className="eyebrow text-[12px] text-ink-muted" dir="ltr">
            Status
          </h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label="שלב נוכחי"
              options={options(FILE_STAGE)}
              value={form.stage}
              onChange={(e) => set('stage', e.target.value)}
            />
            <Select
              label="מצב התיק"
              options={options(FILE_STATUS)}
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            />
            <Select
              label="רמת דחיפות"
              options={options(URGENCY)}
              value={form.urgency}
              onChange={(e) => set('urgency', e.target.value)}
            />
            <Select
              label="אחראי מוביל"
              placeholder="ללא אחראי"
              options={(employees ?? []).map((e) => ({ value: e.id, label: e.name }))}
              value={form.ownerId}
              onChange={(e) => set('ownerId', e.target.value)}
            />
          </div>
          {form.status === 'BLOCKED' && (
            <Input
              label="סיבת החסימה"
              value={form.blockReason}
              onChange={(e) => set('blockReason', e.target.value)}
            />
          )}
        </section>

        <section className="space-y-5 border-t border-hair pt-5">
          <h3 className="eyebrow text-[12px] text-ink-muted" dir="ltr">
            Property
          </h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="סוג העסקה"
              value={form.dealType}
              onChange={(e) => set('dealType', e.target.value)}
            />
            <Input
              label="סוג הנכס"
              value={form.propertyType}
              onChange={(e) => set('propertyType', e.target.value)}
            />
          </div>
          <Input
            label="כתובת הנכס"
            value={form.propertyAddress}
            onChange={(e) => set('propertyAddress', e.target.value)}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            {money('מחיר הרכישה', 'purchasePrice')}
            {money('שווי הנכס', 'propertyValue')}
          </div>
        </section>

        <section className="space-y-5 border-t border-hair pt-5">
          <h3 className="eyebrow text-[12px] text-ink-muted" dir="ltr">
            Financing
          </h3>
          <div className="grid gap-5 sm:grid-cols-2">
            {money('סכום המשכנתא המבוקש', 'requestedAmount')}
            {money('אחוז המימון', 'ltvPercent')}
            {money('הון עצמי', 'equity')}
            {money('החזר חודשי רצוי', 'desiredMonthly')}
            {money('הכנסה נדרשת', 'requiredIncome')}
            {money('הכנסות הלווים', 'borrowersIncome')}
            {money('שכר טרחה', 'agencyFee')}
          </div>
          <Textarea
            label="התחייבויות והלוואות קיימות"
            rows={2}
            value={form.existingLiabilities}
            onChange={(e) => set('existingLiabilities', e.target.value)}
          />
        </section>

        <section className="space-y-5 border-t border-hair pt-5">
          <h3 className="eyebrow text-[12px] text-ink-muted" dir="ltr">
            Next steps
          </h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="תאריך תשלום קרוב"
              type="date"
              dir="ltr"
              value={form.nextPaymentDate}
              onChange={(e) => set('nextPaymentDate', e.target.value)}
            />
            <Input
              label="מועד אחרון לביצוע"
              type="date"
              dir="ltr"
              value={form.executionDeadline}
              onChange={(e) => set('executionDeadline', e.target.value)}
            />
          </div>
          <Input
            label="פעולה אחרונה"
            value={form.lastAction}
            onChange={(e) => set('lastAction', e.target.value)}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="הפעולה הבאה"
              value={form.nextAction}
              onChange={(e) => set('nextAction', e.target.value)}
            />
            <Input
              label="תאריך יעד לפעולה הבאה"
              type="date"
              dir="ltr"
              value={form.nextActionDate}
              onChange={(e) => set('nextActionDate', e.target.value)}
            />
          </div>
        </section>
      </form>
    </Modal>
  )
}

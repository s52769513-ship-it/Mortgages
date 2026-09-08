import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { AVAILABILITY, CLIENT_PRIORITY, CONTACT_METHOD, LEAD_STATUS, options } from '@/lib/labels'
import type { Client, CustomField, Employee } from '@/types'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

const AVAIL_CHANNELS = [
  { key: 'availPhone', label: 'שיחות טלפון' },
  { key: 'availWhatsapp', label: 'וואטסאפ' },
  { key: 'availEmail', label: 'אימייל' },
] as const

export function EditClientModal({
  client,
  open,
  onClose,
}: {
  client: Client
  open: boolean
  onClose: () => void
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    fullName: client.fullName,
    phone: client.phone ?? '',
    email: client.email ?? '',
    leadStatus: client.leadStatus,
    referralSource: client.referralSource ?? '',
    referralDate: client.referralDate?.slice(0, 10) ?? '',
    inquiryType: client.inquiryType ?? '',
    inquiryStatus: client.inquiryStatus ?? '',
    ownerId: client.ownerId ?? '',
    preferredContact: client.preferredContact,
    doNotContact: client.doNotContact,
    introNotes: client.introNotes ?? '',

    // Taken at intake; everything here stays correctable afterwards, because
    // a number heard once over the phone is exactly the kind that changes.
    partnerName: client.partnerName ?? '',
    partnerPhone: client.partnerPhone ?? '',
    declaredIncome: client.declaredIncome ?? '',
    declaredAssets: client.declaredAssets ?? '',
    declaredLiabilities: client.declaredLiabilities ?? '',
    targetDate: client.targetDate?.slice(0, 10) ?? '',
    agreedFee: client.agreedFee ?? '',
    priorities: (client.priorities ?? []) as string[],
    prioritiesNote: client.prioritiesNote ?? '',
    availPhone: client.availPhone ?? '',
    availWhatsapp: client.availWhatsapp ?? '',
    availEmail: client.availEmail ?? '',
  })

  const togglePriority = (value: string) =>
    setForm((prev) => ({
      ...prev,
      priorities: prev.priorities.includes(value)
        ? prev.priorities.filter((p) => p !== value)
        : [...prev.priorities, value],
    }))

  // The office's own fields, held as text while being edited and converted on
  // the way out — an empty box means the value was cleared, not left alone.
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(client.custom ?? {}).map(([key, value]) => [
        key,
        typeof value === 'boolean' ? String(value) : String(value ?? ''),
      ]),
    ),
  )

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees'),
    enabled: open,
  })

  const { data: fields } = useQuery({
    queryKey: ['custom-fields', 'CLIENT'],
    queryFn: () => api.get<{ items: CustomField[] }>('/custom-fields?entity=CLIENT'),
    enabled: open,
  })
  const customFields = fields?.items ?? []

  const save = useMutation({
    mutationFn: () => {
      const orNull = (v: string) => (v.trim() === '' ? null : v.trim())
      return api.patch<Client>(`/clients/${client.id}`, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: orNull(form.email),
        leadStatus: form.leadStatus,
        referralSource: orNull(form.referralSource),
        referralDate: orNull(form.referralDate),
        inquiryType: orNull(form.inquiryType),
        inquiryStatus: orNull(form.inquiryStatus),
        ownerId: form.ownerId || null,
        preferredContact: form.preferredContact,
        doNotContact: form.doNotContact,
        introNotes: orNull(form.introNotes),
        partnerName: orNull(form.partnerName),
        partnerPhone: orNull(form.partnerPhone),
        declaredIncome: String(form.declaredIncome).trim() || null,
        declaredAssets: orNull(String(form.declaredAssets)),
        declaredLiabilities: orNull(String(form.declaredLiabilities)),
        targetDate: orNull(form.targetDate),
        agreedFee: String(form.agreedFee).trim() || null,
        priorities: form.priorities,
        prioritiesNote: orNull(form.prioritiesNote),
        availPhone: form.availPhone || null,
        availWhatsapp: form.availWhatsapp || null,
        availEmail: form.availEmail || null,
        ...(customFields.length ? { custom } : {}),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', client.id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      notify('הלקוח עודכן')
      onClose()
    },
    onError: (e: Error) => notify('העדכון נכשל', { tone: 'error', detail: e.message }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="עריכת הלקוח"
      description="כל שינוי נרשם ביומן הפעילות עם הערך הקודם והחדש."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="edit-client" type="submit" loading={save.isPending}>
            שמור
          </Button>
        </>
      }
    >
      <form id="edit-client" onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="שם מלא"
            required
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
          />
          <Input
            label="טלפון"
            hint="לא חובה — לקוח שיובא מרשימה ישנה עשוי להיות בלי מספר"
            dir="ltr"
            className="numeric"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
          <Input
            label="אימייל"
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
          <Select
            label="סטטוס ליד"
            options={options(LEAD_STATUS)}
            value={form.leadStatus}
            onChange={(e) => set('leadStatus', e.target.value)}
          />
          <Input
            label="מקור הפנייה"
            value={form.referralSource}
            onChange={(e) => set('referralSource', e.target.value)}
          />
          <Input
            label="תאריך הפנייה"
            type="date"
            dir="ltr"
            value={form.referralDate}
            onChange={(e) => set('referralDate', e.target.value)}
          />
          <Input
            label="סוג הפנייה"
            value={form.inquiryType}
            onChange={(e) => set('inquiryType', e.target.value)}
          />
          <Input
            label="סטטוס הפנייה"
            value={form.inquiryStatus}
            onChange={(e) => set('inquiryStatus', e.target.value)}
          />
          <Select
            label="איש קשר מטעם המשרד"
            placeholder="ללא"
            options={(employees ?? []).map((e) => ({ value: e.id, label: e.name }))}
            value={form.ownerId}
            onChange={(e) => set('ownerId', e.target.value)}
          />
          <Select
            label="דרך תקשורת מועדפת"
            options={options(CONTACT_METHOD)}
            value={form.preferredContact}
            onChange={(e) => set('preferredContact', e.target.value)}
          />
        </div>

        <Textarea
          label="הערות משיחת ההיכרות"
          rows={3}
          value={form.introNotes}
          onChange={(e) => set('introNotes', e.target.value)}
        />

        <Checkbox
          label="לא לשלוח הודעות ללקוח זה"
          checked={form.doNotContact}
          onChange={(e) => set('doNotContact', e.target.checked)}
        />

        {/* Everything the intake call collects, kept editable here: the
            opening form asks only what is said on that first call, and the
            rest — a second borrower, a corrected number — is filled in from
            the card afterwards. */}
        <div className="space-y-5 border-t border-hair pt-5">
          <p className="text-[12px] font-semibold text-ink-muted">הלווה השני</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="שם הלווה השני"
              hint="אם המשכנתא נלקחת בזוג"
              value={form.partnerName}
              onChange={(e) => set('partnerName', e.target.value)}
            />
            <Input
              label="טלפון הלווה השני"
              dir="ltr"
              className="numeric"
              value={form.partnerPhone}
              onChange={(e) => set('partnerPhone', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-5 border-t border-hair pt-5">
          <div>
            <p className="text-[12px] font-semibold text-ink-muted">
              התמונה הפיננסית — לפי הצהרת הלקוח
            </p>
            <p className="mt-0.5 text-[12.5px] text-ink-subtle">
              מה שנמסר בשיחה. אף פרט כאן לא אומת מול מסמכים; האימות נעשה בתיק.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="הכנסות חודשיות"
              type="number"
              dir="ltr"
              className="numeric"
              value={String(form.declaredIncome)}
              onChange={(e) => set('declaredIncome', e.target.value)}
            />
            <Input
              label="תאריך ביצוע משוער"
              type="date"
              dir="ltr"
              hint="בערך, כפי שנמסר"
              value={form.targetDate}
              onChange={(e) => set('targetDate', e.target.value)}
            />
          </div>
          <Textarea
            label="נכסים"
            rows={2}
            hint="דירה, חסכונות, רכב — כפי שתוארו"
            value={String(form.declaredAssets)}
            onChange={(e) => set('declaredAssets', e.target.value)}
          />
          <Textarea
            label="התחייבויות"
            rows={2}
            hint="הלוואות קיימות, משכנתא קודמת, אשראי"
            value={String(form.declaredLiabilities)}
            onChange={(e) => set('declaredLiabilities', e.target.value)}
          />
          <Input
            label="שכר טרחה שסוכם"
            type="number"
            dir="ltr"
            className="numeric"
            value={String(form.agreedFee)}
            onChange={(e) => set('agreedFee', e.target.value)}
          />
        </div>

        <div className="space-y-4 border-t border-hair pt-5">
          <p className="text-[12px] font-semibold text-ink-muted">מה חשוב ללקוח</p>
          <div className="flex flex-wrap gap-2">
            {options(CLIENT_PRIORITY).map((option) => {
              const picked = form.priorities.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => togglePriority(option.value)}
                  aria-pressed={picked}
                  className={cn(
                    'rounded-md border px-3.5 py-2 text-[14px] transition-colors duration-micro',
                    picked
                      ? 'border-steel-600 bg-steel-100 font-medium text-steel-800'
                      : 'border-field text-ink-muted hover:border-steel-600 hover:text-ink',
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {form.priorities.includes('OTHER') && (
            <Input
              label="פירוט"
              value={form.prioritiesNote}
              onChange={(e) => set('prioritiesNote', e.target.value)}
            />
          )}
        </div>

        <div className="space-y-4 border-t border-hair pt-5">
          <div>
            <p className="text-[12px] font-semibold text-ink-muted">איך ומתי ליצור קשר</p>
            <p className="mt-0.5 text-[12.5px] text-ink-subtle">
              ערוץ שלא נבחרה בו זמינות לא ישמש לפנייה.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {AVAIL_CHANNELS.map((channel) => (
              <Select
                key={channel.key}
                label={channel.label}
                options={[{ value: '', label: 'לא מועדף' }, ...options(AVAILABILITY)]}
                value={String(form[channel.key])}
                onChange={(e) => set(channel.key, e.target.value)}
              />
            ))}
          </div>
        </div>

        {customFields.length > 0 && (
          <div className="space-y-4 border-t border-hair pt-5">
            <p className="text-[12px] font-semibold text-ink-muted">שדות שהוספתם</p>
            <div className="grid gap-5 sm:grid-cols-2">
              {customFields.map((field) => {
                const value = custom[field.key] ?? ''
                const change = (next: string) =>
                  setCustom((prev) => ({ ...prev, [field.key]: next }))

                if (field.type === 'BOOLEAN') {
                  return (
                    <Checkbox
                      key={field.id}
                      label={field.label}
                      checked={value === 'true'}
                      onChange={(e) => change(e.target.checked ? 'true' : '')}
                    />
                  )
                }
                if (field.type === 'SELECT') {
                  return (
                    <Select
                      key={field.id}
                      label={field.label}
                      placeholder="ללא"
                      options={field.options.map((o) => ({ value: o, label: o }))}
                      value={value}
                      onChange={(e) => change(e.target.value)}
                    />
                  )
                }
                return (
                  <Input
                    key={field.id}
                    label={field.label}
                    type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
                    dir={field.type === 'TEXT' ? undefined : 'ltr'}
                    value={field.type === 'DATE' ? value.slice(0, 10) : value}
                    onChange={(e) => change(e.target.value)}
                  />
                )
              })}
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}

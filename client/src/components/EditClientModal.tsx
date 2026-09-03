import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { CONTACT_METHOD, LEAD_STATUS, options } from '@/lib/labels'
import type { Client, Employee } from '@/types'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

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
    phone: client.phone,
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
            required
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
      </form>
    </Modal>
  )
}

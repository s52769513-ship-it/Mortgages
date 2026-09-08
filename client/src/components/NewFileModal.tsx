import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Client, MortgageFile } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { DealTypeSelect } from '@/components/DealTypeSelect'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

export function NewFileModal({
  open,
  onClose,
  client,
}: {
  open: boolean
  onClose: () => void
  /** When given, the file is opened for this client and the picker is hidden. */
  client?: { id: string; fullName: string }
}) {
  const { notify } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    clientId: client?.id ?? '',
    dealType: '',
    propertyType: '',
    propertyAddress: '',
    purchasePrice: '',
    requestedAmount: '',
    bankName: '',
  })

  const { data: clients } = useQuery({
    queryKey: ['clients', '', ''],
    queryFn: () => api.get<{ items: Client[] }>('/clients?take=200'),
    enabled: open && !client,
  })

  // The office's own shortlist, from Settings — not every bank in the country.
  const { data: banks } = useQuery({
    queryKey: ['banks'],
    queryFn: () => api.get<{ id: string; label: string }[]>('/banks'),
    enabled: open,
    staleTime: 5 * 60_000,
  })

  const create = useMutation({
    mutationFn: () =>
      api.post<MortgageFile>('/files', {
        ...form,
        purchasePrice: form.purchasePrice || null,
        requestedAmount: form.requestedAmount || null,
        bankName: form.bankName || null,
      }),
    onSuccess: (file) => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['client'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      notify('התיק נפתח', {
        detail: form.bankName
          ? `${file.fileNumber} · נפתחה בקשה ל${form.bankName}`
          : file.fileNumber,
      })
      onClose()
      navigate(`/files/${file.id}`)
    },
    onError: (e: Error) => notify('פתיחת התיק נכשלה', { tone: 'error', detail: e.message }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="תיק משכנתא חדש"
      description="מספר התיק נוצר אוטומטית. שאר הפרטים ניתנים להשלמה בדף התיק."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="new-file" type="submit" loading={create.isPending}>
            פתח תיק
          </Button>
        </>
      }
    >
      <form id="new-file" onSubmit={submit} className="space-y-5">
        {client ? (
          <p className="rounded-md bg-busy-tint px-3 py-2.5 text-[14px] text-busy-ink">
            התיק ייפתח עבור <strong className="font-semibold">{client.fullName}</strong>.
          </p>
        ) : (
          <Select
            label="לקוח"
            required
            placeholder="בחר לקוח…"
            options={(clients?.items ?? []).map((c) => ({ value: c.id, label: c.fullName }))}
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          />
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <DealTypeSelect
            value={form.dealType}
            onChange={(v) => setForm({ ...form, dealType: v })}
          />
          <Input
            label="סוג הנכס"
            value={form.propertyType}
            onChange={(e) => setForm({ ...form, propertyType: e.target.value })}
          />
        </div>

        <Input
          label="כתובת הנכס"
          value={form.propertyAddress}
          onChange={(e) => setForm({ ...form, propertyAddress: e.target.value })}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="מחיר רכישה"
            type="number"
            dir="ltr"
            className="numeric"
            value={form.purchasePrice}
            onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
          />
          <Input
            label="סכום משכנתא מבוקש"
            type="number"
            dir="ltr"
            className="numeric"
            value={form.requestedAmount}
            onChange={(e) => setForm({ ...form, requestedAmount: e.target.value })}
          />
        </div>

        <Select
          label="בנק"
          placeholder="ללא בנק בשלב זה"
          hint="בחירת בנק פותחת עבורו מיד בקשה ראשונה כטיוטה, עם הסכום ואחוז המימון שמולאו כאן."
          options={(banks ?? []).map((b) => ({ value: b.label, label: b.label }))}
          value={form.bankName}
          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
        />
      </form>
    </Modal>
  )
}

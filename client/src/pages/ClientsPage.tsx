import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { api, qs } from '@/api/client'
import { relative } from '@/lib/format'
import { CONTACT_METHOD, labelOf, LEAD_STATUS, options } from '@/lib/labels'
import type { Client, Employee } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import {
  ActiveFilterChip,
  Column,
  DataTable,
  FilterBar,
  FilterSelect,
  SearchInput,
  TableFooter,
} from '@/components/DataTable'

const BLANK = {
  fullName: '',
  phone: '',
  email: '',
  leadStatus: 'NEW',
  referralSource: '',
  preferredContact: 'PHONE',
  doNotContact: false,
  introNotes: '',
}

function NewClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notify } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(BLANK)

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees'),
    enabled: open,
  })

  const create = useMutation({
    mutationFn: () => api.post<Client>('/clients', form),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      notify('הליד נוצר', {
        detail: client.fullName,
        action: { label: 'פתח את הכרטיס', onClick: () => navigate(`/clients/${client.id}`) },
      })
      setForm(BLANK)
      onClose()
    },
    onError: (e: Error) => notify('יצירת הליד נכשלה', { tone: 'error', detail: e.message }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ליד חדש"
      description="הפרטים ייקלטו כעת; תיק משכנתא נפתח מתוך כרטיס הלקוח."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="new-client" type="submit" loading={create.isPending}>
            שמור ליד
          </Button>
        </>
      }
    >
      <form id="new-client" onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="שם מלא"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <Input
            label="טלפון"
            required
            dir="ltr"
            className="numeric"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="אימייל"
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="מקור הפנייה"
            hint="המלצה, אתר, פייסבוק, לקוח חוזר"
            value={form.referralSource}
            onChange={(e) => setForm({ ...form, referralSource: e.target.value })}
          />
          <Select
            label="סטטוס ליד"
            options={options(LEAD_STATUS)}
            value={form.leadStatus}
            onChange={(e) => setForm({ ...form, leadStatus: e.target.value })}
          />
          <Select
            label="דרך תקשורת מועדפת"
            options={options(CONTACT_METHOD)}
            value={form.preferredContact}
            onChange={(e) => setForm({ ...form, preferredContact: e.target.value })}
          />
        </div>

        <Textarea
          label="הערות משיחת ההיכרות"
          value={form.introNotes}
          onChange={(e) => setForm({ ...form, introNotes: e.target.value })}
        />

        <Checkbox
          label="לא לשלוח הודעות ללקוח זה"
          checked={form.doNotContact}
          onChange={(e) => setForm({ ...form, doNotContact: e.target.checked })}
        />

        {employees && employees.length > 0 && (
          <p className="text-[12px] text-ink-subtle">
            איש קשר מטעם המשרד ייקבע אוטומטית ויהיה ניתן לשינוי בכרטיס.
          </p>
        )}
      </form>
    </Modal>
  )
}

export function ClientsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clients', search, status],
    queryFn: () =>
      api.get<{ items: Client[]; total: number }>(`/clients${qs({ q: search, status })}`),
  })

  const filtered = Boolean(search || status)

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'שם הלקוח',
      width: '1.3fr',
      render: (c) => (
        <span className="block truncate text-[15px] font-medium text-ink">
          {c.fullName}
          {c.doNotContact && (
            <span className="ms-2 text-[12px] font-normal text-urgent">· אין לשלוח</span>
          )}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'טלפון',
      width: '0.9fr',
      render: (c) => (
        <span className="numeric block truncate text-[14px] text-ink-muted" dir="ltr">
          {c.phone}
        </span>
      ),
    },
    {
      key: 'source',
      header: 'מקור הפנייה',
      width: '1fr',
      render: (c) => (
        <span className="block truncate text-[14px] text-ink-muted">{c.referralSource || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'סטטוס ליד',
      width: '0.9fr',
      render: (c) => (
        <Badge tone={labelOf(LEAD_STATUS, c.leadStatus).tone}>
          {labelOf(LEAD_STATUS, c.leadStatus).label}
        </Badge>
      ),
    },
    {
      key: 'files',
      header: 'תיקים',
      width: '0.8fr',
      render: (c) => (
        <span className="numeric text-[14px] text-ink-muted" dir="ltr">
          {c._count?.files || '—'}
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'עדכון אחרון',
      width: '0.7fr',
      render: (c) => <span className="text-[13.5px] text-ink-subtle">{relative(c.updatedAt)}</span>,
    },
  ]

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair px-7 py-5">
          <div>
            <h1 className="font-heading text-[32px] font-bold leading-tight text-ink">
              לקוחות ולידים
            </h1>
            {data && (
              <p className="mt-1 text-[15px] text-ink-muted">
                <span className="numeric" dir="ltr">
                  {data.total}
                </span>{' '}
                רשומות
              </p>
            )}
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            ליד חדש
          </Button>
        </div>

        <FilterBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="חיפוש לפי שם או טלפון…"
          />
          <FilterSelect
            value={status}
            onChange={setStatus}
            options={options(LEAD_STATUS)}
            placeholder="סטטוס ליד"
          />
          {status && (
            <ActiveFilterChip
              label={`סטטוס: ${labelOf(LEAD_STATUS, status).label}`}
              onClear={() => setStatus('')}
            />
          )}
        </FilterBar>

        {error ? (
          <ErrorState message="לא הצלחנו לטעון את רשימת הלקוחות." onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton cols={6} />
        ) : !data?.items.length ? (
          <EmptyState
            icon={<Users className="size-7" />}
            title={filtered ? 'לא נמצאו לקוחות בסינון הזה' : 'אין עדיין לקוחות'}
            description={
              filtered
                ? 'הסינון הנוכחי לא החזיר תוצאות. אפשר לנקות אותו ולראות את כל הרשומות.'
                : 'כל ליד שנכנס למשרד מתחיל כאן, ומשם נפתח לו תיק משכנתא.'
            }
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('')
                    setStatus('')
                  }}
                >
                  נקה מסננים
                </Button>
              ) : (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="size-4" />
                  ליד חדש
                </Button>
              )
            }
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data.items}
              toneOf={(c) => labelOf(LEAD_STATUS, c.leadStatus).tone}
              linkTo={(c) => `/clients/${c.id}`}
              minWidth={900}
            />
            <TableFooter
              shown={data.items.length}
              total={data.total}
              hint="לחיצה על שורה פותחת את כרטיס הלקוח"
            />
          </>
        )}
      </Card>

      <NewClientModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

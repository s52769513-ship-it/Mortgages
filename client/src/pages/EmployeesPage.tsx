import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/lib/auth'
import { date } from '@/lib/format'
import { labelOf, options, ROLE } from '@/lib/labels'
import type { Employee } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { Column, DataTable, TableFooter } from '@/components/DataTable'

type Row = Employee & {
  createdAt: string
  _count?: { filesOwned: number; tasksOwned: number; clientsOwned: number }
}

const BLANK = { name: '', email: '', password: '', role: 'AGENT', phone: '', team: '' }

function EmployeeModal({
  employee,
  open,
  onClose,
}: {
  employee: Row | null
  open: boolean
  onClose: () => void
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const editing = Boolean(employee)

  const [form, setForm] = useState(
    employee
      ? {
          name: employee.name,
          email: employee.email,
          password: '',
          role: employee.role,
          phone: employee.phone ?? '',
          team: employee.team ?? '',
        }
      : BLANK,
  )

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        phone: form.phone || null,
        team: form.team || null,
        // An empty box on an edit means "leave the password alone".
        ...(form.password ? { password: form.password } : {}),
      }
      return editing
        ? api.patch<Employee>(`/employees/${employee!.id}`, payload)
        : api.post<Employee>('/employees', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      notify(editing ? 'המשתמש עודכן' : 'המשתמש נוצר')
      onClose()
    },
    onError: (e: Error) =>
      notify(editing ? 'העדכון נכשל' : 'יצירת המשתמש נכשלה', { tone: 'error', detail: e.message }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'עריכת משתמש' : 'משתמש חדש'}
      description={
        editing
          ? 'שדה סיסמה ריק משאיר את הסיסמה הקיימת ללא שינוי.'
          : 'המשתמש יוכל להתחבר מיד עם האימייל והסיסמה שתגדיר.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="employee-form" type="submit" loading={save.isPending}>
            שמור
          </Button>
        </>
      }
    >
      <form id="employee-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="שם מלא"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="כתובת אימייל"
            type="email"
            dir="ltr"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label={editing ? 'סיסמה חדשה' : 'סיסמה'}
            type="password"
            required={!editing}
            hint="לפחות 8 תווים"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Select
            label="תפקיד"
            options={options(ROLE)}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
          <Input
            label="טלפון"
            dir="ltr"
            className="numeric"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="צוות"
            value={form.team}
            onChange={(e) => setForm({ ...form, team: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  )
}

export function EmployeesPage() {
  const { user } = useAuth()
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Row | null>(null)
  const [creating, setCreating] = useState(false)

  const isAdmin = user?.role === 'ADMIN'

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => api.get<Row[]>('/employees?includeInactive=1'),
  })

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch<Employee>(`/employees/${id}`, { active }),
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      notify(employee.active ? 'המשתמש הופעל' : 'המשתמש הושבת')
    },
    onError: (e: Error) => notify('הפעולה נכשלה', { tone: 'error', detail: e.message }),
  })

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'שם',
      width: '1.4fr',
      render: (e) => (
        <>
          <span className="block truncate text-[15px] font-medium text-ink">{e.name}</span>
          <span className="block truncate text-[13px] text-ink-muted" dir="ltr">
            {e.email}
          </span>
        </>
      ),
    },
    {
      key: 'role',
      header: 'תפקיד',
      width: '0.9fr',
      render: (e) => <span className="text-[14px] text-ink-muted">{labelOf(ROLE, e.role).label}</span>,
    },
    {
      key: 'team',
      header: 'צוות',
      width: '0.8fr',
      render: (e) => <span className="text-[14px] text-ink-muted">{e.team || '—'}</span>,
    },
    {
      key: 'phone',
      header: 'טלפון',
      width: '0.8fr',
      render: (e) => (
        <span className="numeric block truncate text-[14px] text-ink-muted" dir="ltr">
          {e.phone || '—'}
        </span>
      ),
    },
    {
      key: 'load',
      header: 'תיקים · משימות',
      width: '0.9fr',
      render: (e) => (
        <span className="numeric text-[14px] text-ink-muted" dir="ltr">
          {e._count ? `${e._count.filesOwned} · ${e._count.tasksOwned}` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'מצב',
      width: '0.7fr',
      render: (e) => (
        <Badge tone={e.active ? 'ok' : 'neutral'}>{e.active ? 'פעיל' : 'מושבת'}</Badge>
      ),
    },
    {
      key: 'created',
      header: 'נוצר',
      width: '0.7fr',
      render: (e) => (
        <span className="numeric block text-[13.5px] text-ink-subtle" dir="ltr">
          {date(e.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair px-7 py-5">
          <div>
            <h1 className="font-heading text-[32px] font-bold leading-tight text-ink">משתמשים</h1>
            {data && (
              <p className="mt-1 text-[15px] text-ink-muted">
                <span className="numeric" dir="ltr">
                  {data.filter((e) => e.active).length}
                </span>{' '}
                פעילים מתוך{' '}
                <span className="numeric" dir="ltr">
                  {data.length}
                </span>
              </p>
            )}
          </div>
          {isAdmin && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              משתמש חדש
            </Button>
          )}
        </div>

        {!isAdmin && (
          <p className="border-b border-hair bg-busy-tint px-7 py-3 text-[14px] text-busy-ink">
            רק מנהל מערכת יכול להוסיף או לערוך משתמשים. הרשימה מוצגת לצפייה בלבד.
          </p>
        )}

        {error ? (
          <ErrorState message="לא הצלחנו לטעון את המשתמשים." onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton cols={7} />
        ) : !data?.length ? (
          <EmptyState
            icon={<Users className="size-7" />}
            title="אין עדיין משתמשים"
            description="כל מי שעובד במשרד צריך חשבון משלו, כדי שיומן הפעילות ידע מי עשה מה."
            action={isAdmin && <Button onClick={() => setCreating(true)}>משתמש חדש</Button>}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data}
              toneOf={(e) => (e.active ? 'busy' : 'neutral')}
              rowActions={
                isAdmin
                  ? (e) => (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(e)}>
                          ערוך
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={setActive.isPending && setActive.variables?.id === e.id}
                          loadingLabel="…"
                          onClick={() => setActive.mutate({ id: e.id, active: !e.active })}
                        >
                          {e.active ? 'השבת' : 'הפעל'}
                        </Button>
                      </>
                    )
                  : undefined
              }
              minWidth={1020}
            />
            <TableFooter
              shown={data.length}
              total={data.length}
              hint={isAdmin ? 'ריחוף על שורה חושף עריכה והשבתה' : undefined}
            />
          </>
        )}
      </Card>

      {creating && <EmployeeModal employee={null} open onClose={() => setCreating(false)} />}
      {editing && <EmployeeModal employee={editing} open onClose={() => setEditing(null)} />}
    </>
  )
}

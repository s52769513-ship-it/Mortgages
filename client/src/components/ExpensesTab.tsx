import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Receipt, Trash2 } from 'lucide-react'
import { api, qs } from '@/api/client'
import { date, money } from '@/lib/format'
import type { Expense, MortgageFile } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'

const today = () => new Date().toISOString().slice(0, 10)

function AddModal({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ amount: '', details: '', spentAt: today() })
  const [touched, setTouched] = useState(false)

  const create = useMutation({
    mutationFn: () =>
      api.post<Expense>('/expenses', {
        fileId,
        amount: form.amount,
        details: form.details.trim(),
        spentAt: form.spentAt || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', fileId] })
      queryClient.invalidateQueries({ queryKey: ['file', fileId] })
      notify('ההוצאה נרשמה')
      onClose()
    },
    onError: (e: Error) => notify('רישום ההוצאה נכשל', { tone: 'error', detail: e.message }),
  })

  const invalidAmount = !form.amount || Number(form.amount) <= 0
  const missingDetails = form.details.trim().length < 2

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (invalidAmount || missingDetails) return
    create.mutate()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="הוצאה חדשה"
      description="הוצאות המשרד על התיק — שמאות, אגרות, שליחויות."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="new-expense" type="submit" loading={create.isPending}>
            שמור
          </Button>
        </>
      }
    >
      <form id="new-expense" onSubmit={submit} className="space-y-5">
        <Input
          label="פירוט"
          required
          value={form.details}
          onChange={(e) => setForm({ ...form, details: e.target.value })}
          error={touched && missingDetails ? 'נדרש פירוט' : undefined}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="סכום"
            type="number"
            step="0.01"
            dir="ltr"
            className="numeric"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            error={touched && invalidAmount ? 'נדרש סכום גדול מאפס' : undefined}
          />
          <Input
            label="תאריך"
            type="date"
            dir="ltr"
            value={form.spentAt}
            onChange={(e) => setForm({ ...form, spentAt: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  )
}

/** Costs the office carries on a file — the other half of the fee. */
export function ExpensesTab({ file }: { file: MortgageFile }) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['expenses', file.id],
    queryFn: () =>
      api.get<{ items: Expense[]; total: string }>(`/expenses${qs({ fileId: file.id })}`),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', file.id] })
      notify('ההוצאה נמחקה')
    },
    onError: (e: Error) => notify('המחיקה נכשלה', { tone: 'error', detail: e.message }),
  })

  if (error) return <ErrorState message="לא הצלחנו לטעון את ההוצאות." onRetry={() => refetch()} />

  const spent = Number(data?.total ?? 0)
  const fee = Number(file.agencyFee ?? 0)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-7 py-3">
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[13px]">
          <span className="flex items-baseline gap-1.5">
            <dt className="text-ink-subtle">שכר טרחה</dt>
            <dd className="numeric font-medium text-ink" dir="ltr">
              {money(file.agencyFee)}
            </dd>
          </span>
          <span className="flex items-baseline gap-1.5">
            <dt className="text-ink-subtle">הוצאות</dt>
            <dd className="numeric font-medium text-ink" dir="ltr">
              {money(spent)}
            </dd>
          </span>
          {fee > 0 && (
            <span className="flex items-baseline gap-1.5">
              <dt className="text-ink-subtle">נותר</dt>
              <dd
                className={`numeric font-semibold ${fee - spent < 0 ? 'text-urgent' : 'text-ok-ink'}`}
                dir="ltr"
              >
                {money(fee - spent)}
              </dd>
            </span>
          )}
        </dl>

        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          הוצאה חדשה
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-7">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Receipt className="size-7" />}
          title="לא נרשמו הוצאות"
          description="שמאות, אגרות ושליחויות שהמשרד שילם על התיק. בלעדיהן אי אפשר לדעת כמה הוא הכניס בפועל."
          action={<Button onClick={() => setAdding(true)}>רשום הוצאה</Button>}
        />
      ) : (
        <ul className="divide-y divide-row">
          {data.items.map((expense) => (
            <li
              key={expense.id}
              className="group flex items-center gap-4 px-7 py-3 transition-colors duration-micro hover:bg-ink/[0.04]"
            >
              <span className="numeric w-24 shrink-0 text-[13px] text-ink-subtle" dir="ltr">
                {date(expense.spentAt)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">
                {expense.details}
              </span>
              <span className="numeric shrink-0 text-[14px] font-medium text-ink" dir="ltr">
                {money(expense.amount)}
              </span>
              <button
                onClick={() => remove.mutate(expense.id)}
                aria-label={`מחיקת ${expense.details}`}
                className="shrink-0 rounded p-1 text-ink-subtle opacity-0 transition-all duration-micro hover:text-urgent group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && <AddModal fileId={file.id} onClose={() => setAdding(false)} />}
    </>
  )
}

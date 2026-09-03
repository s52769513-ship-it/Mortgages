import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ListChecks } from 'lucide-react'
import { api, qs } from '@/api/client'
import { cn } from '@/lib/cn'
import { date, isOverdue, relative, time } from '@/lib/format'
import { labelOf, options, TASK_PRIORITY, TASK_STATUS } from '@/lib/labels'
import type { Task } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/Field'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States'
import { useListing } from '@/lib/useListing'
import {
  ActiveFilterChip,
  Column,
  DataTable,
  FilterBar,
  FilterSelect,
  SearchInput,
  TableFooter,
} from '@/components/DataTable'
import { TaskOverlay } from '@/components/TaskOverlay'

type Scope = 'all' | 'mine' | 'overdue'

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'הכל' },
  { value: 'mine', label: 'שלי' },
  { value: 'overdue', label: 'חורגות' },
]

export function TasksPage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)

  const status = params.get('status') ?? ''
  const scope: Scope = params.get('overdue') === '1' ? 'overdue' : (params.get('scope') as Scope) || 'all'

  const setScope = (next: Scope) => {
    const p = new URLSearchParams(params)
    p.delete('scope')
    p.delete('overdue')
    if (next === 'mine') p.set('scope', 'mine')
    if (next === 'overdue') p.set('overdue', '1')
    setParams(p, { replace: true })
  }

  const setStatus = (value: string) => {
    const p = new URLSearchParams(params)
    if (value) p.set('status', value)
    else p.delete('status')
    setParams(p, { replace: true })
  }

  const listing = useListing(`${search}|${status}|${priority}|${scope}`)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tasks', search, status, priority, scope, listing.params],
    queryFn: () =>
      api.get<{ items: Task[]; total: number }>(
        `/tasks${qs({
          q: search,
          status,
          priority,
          scope: scope === 'mine' ? 'mine' : '',
          overdue: scope === 'overdue' ? '1' : '',
          ...listing.params,
        })}`,
      ),
  })

  const filtered = Boolean(search || status || priority || scope !== 'all')

  const columns: Column<Task>[] = [
    {
      key: 'title',
      header: 'משימה',
      width: '1.6fr',
      sortKey: 'title',
      render: (t) => (
        <>
          <span className="block truncate text-[15px] font-medium text-ink">{t.title}</span>
          {t.waitingOn && (
            <span className="block truncate text-[13px] text-ink-muted">
              ממתין ל{t.waitingOn}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'file',
      header: 'תיק',
      width: '1.1fr',
      render: (t) => (
        <>
          <span className="numeric block truncate text-[13.5px] text-steel-700" dir="ltr">
            {t.file?.fileNumber}
            <span className="text-ink-subtle"> · {t.seq}</span>
          </span>
          <span className="block truncate text-[13px] text-ink-muted">
            {t.file?.client.fullName}
          </span>
        </>
      ),
    },
    {
      key: 'owner',
      header: 'אחראי',
      width: '0.9fr',
      render: (t) => (
        <span className="block truncate text-[14px] text-ink-muted">{t.owner?.name ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'סטטוס',
      width: '1fr',
      sortKey: 'status',
      render: (t) => (
        <Badge tone={labelOf(TASK_STATUS, t.status).tone}>
          {labelOf(TASK_STATUS, t.status).label}
        </Badge>
      ),
    },
    {
      key: 'priority',
      header: 'עדיפות',
      width: '0.7fr',
      sortKey: 'priority',
      render: (t) => (
        <span
          className={cn(
            'text-[13.5px]',
            t.priority === 'URGENT'
              ? 'font-medium text-urgent-ink'
              : t.priority === 'HIGH'
                ? 'text-wait-ink'
                : 'text-ink-muted',
          )}
        >
          {labelOf(TASK_PRIORITY, t.priority).label}
        </span>
      ),
    },
    {
      key: 'due',
      header: 'יעד',
      width: '0.9fr',
      sortKey: 'dueAt',
      render: (t) => {
        if (t.status === 'COMPLETED') {
          return (
            <span className="numeric block text-[13.5px] text-ok-ink" dir="ltr">
              {date(t.completedAt)}
            </span>
          )
        }
        const overdue = isOverdue(t.dueAt)
        return (
          <span
            className={cn(
              'numeric block text-[13.5px]',
              overdue ? 'font-medium text-urgent-ink' : 'text-ink-subtle',
            )}
            dir="ltr"
          >
            {t.dueAt ? `${date(t.dueAt)} ${time(t.dueAt)}` : '—'}
          </span>
        )
      },
    },
  ]

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair px-7 py-5">
          <div>
            <h1 className="font-heading text-[32px] font-bold leading-tight text-ink">משימות</h1>
            {data && (
              <p className="mt-1 text-[15px] text-ink-muted">
                <span className="numeric" dir="ltr">
                  {data.total}
                </span>{' '}
                משימות בכל התיקים
              </p>
            )}
          </div>
          <div className="w-64">
            <SegmentedControl value={scope} onChange={setScope} options={SCOPES} />
          </div>
        </div>

        <FilterBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="חיפוש לפי משימה, תיק או לקוח…"
          />
          <FilterSelect
            value={status}
            onChange={setStatus}
            options={options(TASK_STATUS)}
            placeholder="סטטוס"
          />
          <FilterSelect
            value={priority}
            onChange={setPriority}
            options={options(TASK_PRIORITY)}
            placeholder="עדיפות"
          />
          {status && (
            <ActiveFilterChip
              label={`סטטוס: ${labelOf(TASK_STATUS, status).label}`}
              onClear={() => setStatus('')}
            />
          )}
          {priority && (
            <ActiveFilterChip
              label={`עדיפות: ${labelOf(TASK_PRIORITY, priority).label}`}
              onClear={() => setPriority('')}
            />
          )}
        </FilterBar>

        {error ? (
          <ErrorState message="לא הצלחנו לטעון את המשימות." onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton cols={6} />
        ) : !data?.items.length ? (
          <EmptyState
            icon={<ListChecks className="size-7" />}
            tone={scope === 'overdue' ? 'ok' : 'neutral'}
            title={
              scope === 'overdue'
                ? 'אין משימות שחורגות מהיעד'
                : filtered
                  ? 'לא נמצאו משימות בסינון הזה'
                  : 'אין עדיין משימות'
            }
            description={
              scope === 'overdue'
                ? 'כל המשימות הפתוחות עדיין בתוך התאריך שנקבע להן.'
                : filtered
                  ? 'הסינון הנוכחי לא החזיר תוצאות. אפשר לנקות אותו ולראות את כל המשימות.'
                  : 'משימות נפתחות מתוך דף התיק, ומרוכזות כאן על פני כל התיקים.'
            }
            action={
              filtered && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('')
                    setPriority('')
                    setParams(new URLSearchParams(), { replace: true })
                  }}
                >
                  נקה מסננים
                </Button>
              )
            }
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data.items}
              toneOf={(t) => labelOf(TASK_STATUS, t.status).tone}
              rowActions={(t) => (
                <Button size="sm" variant="secondary" onClick={() => setEditing(t)}>
                  ערוך
                </Button>
              )}
              minWidth={1040}
              sort={listing.sort}
              onSort={listing.setSort}
            />
            <TableFooter
              shown={data.items.length}
              total={data.total}
              page={listing.page}
              pageSize={listing.pageSize}
              onPage={listing.setPage}
              hint="ריחוף על שורה חושף עריכה"
            />
          </>
        )}
      </Card>

      <TaskOverlay task={editing} open={Boolean(editing)} onClose={() => setEditing(null)} />
    </>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Pencil } from 'lucide-react'
import { api, qs } from '@/api/client'
import { cn } from '@/lib/cn'
import { date, money, percent } from '@/lib/format'
import { BANK_APP_STATUS, labelOf, options } from '@/lib/labels'
import type { BankApplication } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States'
import { BankApplicationModal } from '@/components/BankApplicationModal'
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

/** An approval that lapses is worth more warning than one that already has. */
function ApprovalValidity({ until }: { until: string | null }) {
  if (!until) return <span className="text-[13.5px] text-ink-subtle">—</span>

  const days = Math.floor((new Date(until).getTime() - Date.now()) / 86_400_000)
  const tone = days < 0 ? 'text-urgent-ink' : days <= 7 ? 'text-wait-ink font-medium' : 'text-ink-muted'

  return (
    <span className={cn('numeric block text-[13.5px]', tone)} dir="ltr">
      {date(until)}
      {days >= 0 && days <= 7 && <span className="ms-1">({days}d)</span>}
    </span>
  )
}

export function BankApplicationsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<BankApplication | null>(null)

  const listing = useListing(`${search}|${status}`)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bank-applications', search, status, listing.params],
    queryFn: () =>
      api.get<{ items: BankApplication[]; total: number }>(
        `/bank-applications${qs({ q: search, status, ...listing.params })}`,
      ),
  })

  const filtered = Boolean(search || status)

  const columns: Column<BankApplication>[] = [
    {
      key: 'bank',
      header: 'בנק וסניף',
      width: '1.3fr',
      render: (a) => (
        <>
          <span className="block truncate text-[15px] font-medium text-ink">{a.bank?.name}</span>
          <span className="block truncate text-[13px] text-ink-muted">
            {a.branch?.name ? `סניף ${a.branch.name}` : 'ללא סניף'}
            {a.banker?.name && ` · ${a.banker.name}`}
          </span>
        </>
      ),
    },
    {
      key: 'file',
      header: 'תיק',
      width: '1.1fr',
      render: (a) => (
        <>
          <span className="numeric block truncate text-[13.5px] text-steel-700" dir="ltr">
            {a.file?.fileNumber}
          </span>
          <span className="block truncate text-[13px] text-ink-muted">
            {a.file?.client.fullName}
          </span>
        </>
      ),
    },
    {
      key: 'status',
      header: 'סטטוס',
      width: '1fr',
      sortKey: 'status',
      render: (a) => (
        <Badge tone={labelOf(BANK_APP_STATUS, a.status).tone}>
          {labelOf(BANK_APP_STATUS, a.status).label}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'סכום מבוקש',
      width: '0.9fr',
      sortKey: 'requestedAmount',
      render: (a) => (
        <span className="numeric block text-[14px] text-ink-muted" dir="ltr">
          {money(a.requestedAmount)}
        </span>
      ),
    },
    {
      key: 'ltv',
      header: 'מימון',
      width: '0.6fr',
      render: (a) => (
        <span className="numeric block text-[14px] text-ink-muted" dir="ltr">
          {percent(a.ltvPercent)}
        </span>
      ),
    },
    {
      key: 'rates',
      header: 'ריבית מוצעת',
      width: '1fr',
      render: (a) => (
        <span className="block truncate text-[13.5px] text-ink">{a.offeredRates || '—'}</span>
      ),
    },
    {
      key: 'validity',
      header: 'תוקף האישור',
      width: '0.8fr',
      render: (a) => <ApprovalValidity until={a.approvalValidUntil} />,
    },
    {
      key: 'missing',
      header: 'חוסרים',
      width: '0.8fr',
      render: (a) => (
        <span
          className={cn(
            'block truncate text-[13.5px]',
            a.missingItems ? 'text-wait-ink' : 'text-ink-subtle',
          )}
        >
          {a.missingItems || 'אין'}
        </span>
      ),
    },
  ]

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair px-7 py-5">
        <div>
          <h1 className="font-heading text-[32px] font-bold leading-tight text-ink">
            בקשות לבנק
          </h1>
          {data && (
            <p className="mt-1 text-[15px] text-ink-muted">
              <span className="numeric" dir="ltr">
                {data.total}
              </span>{' '}
              בקשות בכל התיקים
            </p>
          )}
        </div>
      </div>

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="חיפוש לפי בנק, תיק או לקוח…"
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={options(BANK_APP_STATUS)}
          placeholder="סטטוס הבקשה"
        />
        {status && (
          <ActiveFilterChip
            label={`סטטוס: ${labelOf(BANK_APP_STATUS, status).label}`}
            onClear={() => setStatus('')}
          />
        )}
      </FilterBar>

      {error ? (
        <ErrorState message="לא הצלחנו לטעון את הבקשות." onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton cols={8} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Building2 className="size-7" />}
          title={filtered ? 'לא נמצאו בקשות בסינון הזה' : 'עוד לא הוגשו בקשות לבנק'}
          description={
            filtered
              ? 'הסינון הנוכחי לא החזיר תוצאות. אפשר לנקות אותו ולראות את כל הבקשות.'
              : 'לכל בנק נפתחת בקשה נפרדת מתוך דף התיק, וכולן מרוכזות כאן.'
          }
          action={
            filtered && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('')
                  setStatus('')
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
            toneOf={(a) => labelOf(BANK_APP_STATUS, a.status).tone}
            linkTo={(a) => `/files/${a.fileId}`}
            rowActions={(a) => (
              <Button size="sm" variant="secondary" onClick={() => setEditing(a)}>
                <Pencil className="size-3.5" />
                ערוך
              </Button>
            )}
            minWidth={1180}
            sort={listing.sort}
            onSort={listing.setSort}
          />
          <TableFooter
            shown={data.items.length}
            total={data.total}
            page={listing.page}
            pageSize={listing.pageSize}
            onPage={listing.setPage}
            hint="לחיצה על שורה פותחת את התיק · ריחוף חושף עריכה"
          />
        </>
      )}

      {editing && (
        <BankApplicationModal
          fileId={editing.fileId}
          application={editing}
          open
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  )
}

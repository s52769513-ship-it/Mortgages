import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { api, qs } from '@/api/client'
import { relative } from '@/lib/format'
import { labelOf, LEAD_STATUS, options } from '@/lib/labels'
import type { Client } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States'
import { useListing } from '@/lib/useListing'
import { NewLeadModal } from '@/components/NewLeadModal'
import {
  ActiveFilterChip,
  Column,
  DataTable,
  FilterBar,
  FilterSelect,
  SearchInput,
  TableFooter,
} from '@/components/DataTable'

export function ClientsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const [params, setParams] = useSearchParams()

  // The mobile FAB opens this screen with ?new=1.
  useEffect(() => {
    if (!params.get('new')) return
    setCreating(true)
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }, [params, setParams])

  const listing = useListing(`${search}|${status}`)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clients', search, status, listing.params],
    queryFn: () =>
      api.get<{ items: Client[]; total: number }>(
        `/clients${qs({ q: search, status, ...listing.params })}`,
      ),
  })

  const filtered = Boolean(search || status)

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'שם הלקוח',
      width: '1.3fr',
      sortKey: 'fullName',
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
      sortKey: 'leadStatus',
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
      sortKey: 'updatedAt',
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
              sort={listing.sort}
              onSort={listing.setSort}
            />
            <TableFooter
              shown={data.items.length}
              total={data.total}
              page={listing.page}
              pageSize={listing.pageSize}
              onPage={listing.setPage}
              hint="לחיצה על שורה פותחת את כרטיס הלקוח"
            />
          </>
        )}
      </Card>

      <NewLeadModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

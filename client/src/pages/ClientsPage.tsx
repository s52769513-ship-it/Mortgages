import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Plus, SlidersHorizontal, Upload, Users } from 'lucide-react'
import { api, qs } from '@/api/client'
import { livePoll } from '@/lib/livePolling'
import { relative } from '@/lib/format'
import { labelOf, LEAD_STATUS, options } from '@/lib/labels'
import type { Client } from '@/types'
import { Card } from '@/components/ui/Card'
import { RowSelect, type RowOption } from '@/components/RowSelect'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States'
import { useListing } from '@/lib/useListing'
import { NewLeadModal } from '@/components/NewLeadModal'
import { ImportClientsModal } from '@/components/ImportClientsModal'
import { CustomFieldsModal } from '@/components/CustomFieldsModal'
import { Menu, MenuItem } from '@/components/ui/Menu'
import { cn } from '@/lib/cn'
import {
  ActiveFilterChip,
  Column,
  DataTable,
  FilterBar,
  FilterSelect,
  SearchInput,
  TableFooter,
} from '@/components/DataTable'

/** Built once — the same list for every row. */
const LEAD_STATUS_OPTIONS: RowOption[] = Object.entries(LEAD_STATUS).map(([value, e]) => ({
  value,
  label: e.label,
  tone: e.tone,
}))

export function ClientsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [managingFields, setManagingFields] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { notify } = useToast()

  /** The lead's status, moved from the row rather than from its card. */
  const setLeadStatus = useMutation({
    mutationFn: ({ id, leadStatus }: { id: string; leadStatus: string; done: string }) =>
      api.patch(`/clients/${id}`, { leadStatus }),
    onMutate: ({ id }) => setSavingId(id),
    onSettled: () => setSavingId(null),
    onSuccess: (_r, { done }) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify('סטטוס הליד עודכן', { detail: done })
    },
    onError: (e: Error) => notify('עדכון הסטטוס נכשל', { tone: 'error', detail: e.message }),
  })

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
    ...livePoll,
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
        <span className="numeric text-right block truncate text-[14px] text-ink-muted" dir="ltr">
          {c.phone || '—'}
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
      width: '1fr',
      sortKey: 'leadStatus',
      render: (c) => (
        <RowSelect
          menuLabel={`שינוי סטטוס הליד ${c.fullName}`}
          heading="שינוי סטטוס"
          value={c.leadStatus}
          options={LEAD_STATUS_OPTIONS}
          pending={savingId === c.id}
          onSelect={(leadStatus) =>
            setLeadStatus.mutate({
              id: c.id,
              leadStatus,
              done: labelOf(LEAD_STATUS, leadStatus).label,
            })
          }
        />
      ),
    },
    {
      key: 'files',
      header: 'תיקים',
      width: '0.8fr',
      render: (c) => (
        <span className="numeric text-right text-[14px] text-ink-muted" dir="ltr">
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
          <div className="flex items-center gap-3">
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              ליד חדש
            </Button>

            <Menu
              label="פעולות נוספות ברשימת הלקוחות"
              align="end"
              width={230}
              className="shrink-0"
              trigger={({ open }) => (
                <span
                  className={cn(
                    'flex size-11 items-center justify-center rounded-md border border-field text-ink-muted md:size-9',
                    'transition-colors duration-micro ease-standard hover:bg-ink/[0.04] hover:text-ink',
                    open && 'bg-ink/[0.06] text-ink',
                  )}
                >
                  <MoreHorizontal className="size-4" />
                </span>
              )}
            >
              {(close) => (
                <>
                  <MenuItem
                    onClick={() => {
                      close()
                      setImporting(true)
                    }}
                  >
                    <Upload className="size-4" />
                    ייבוא לקוחות מקובץ
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      close()
                      setManagingFields(true)
                    }}
                  >
                    <SlidersHorizontal className="size-4" />
                    שדות שהוספתם
                  </MenuItem>
                </>
              )}
            </Menu>
          </div>
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
      <ImportClientsModal open={importing} onClose={() => setImporting(false)} />
      <CustomFieldsModal open={managingFields} onClose={() => setManagingFields(false)} />
    </>
  )
}

import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FolderOpen, Plus } from 'lucide-react'
import { api, qs } from '@/api/client'
import { cn } from '@/lib/cn'
import { date, money, relative } from '@/lib/format'
import { FILE_STAGE, FILE_STATUS, labelOf, options, URGENCY } from '@/lib/labels'
import type { MortgageFile } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States'
import { NewFileModal } from '@/components/NewFileModal'
import {
  ActiveFilterChip,
  Column,
  DataTable,
  FilterBar,
  FilterSelect,
  SearchInput,
  TableFooter,
} from '@/components/DataTable'

export function FilesPage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const stage = params.get('stage') ?? ''
  const status = params.get('status') ?? ''

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['files', search, stage, status],
    queryFn: () =>
      api.get<{ items: MortgageFile[]; total: number }>(`/files${qs({ q: search, stage, status })}`),
  })

  const filtered = Boolean(search || stage || status)

  const columns: Column<MortgageFile>[] = [
    {
      key: 'number',
      header: 'מספר תיק',
      width: '1.1fr',
      render: (f) => (
        <span className="numeric block truncate text-[14px] font-semibold text-steel-700" dir="ltr">
          {f.fileNumber}
        </span>
      ),
    },
    {
      key: 'client',
      header: 'לקוח',
      width: '1.4fr',
      render: (f) => (
        <>
          <span className="block truncate text-[15px] font-medium text-ink">
            {f.client?.fullName}
          </span>
          <span className="block truncate text-[13px] text-ink-muted">
            {f.propertyAddress || '—'}
          </span>
        </>
      ),
    },
    {
      key: 'amount',
      header: 'סכום מבוקש',
      width: '0.9fr',
      render: (f) => (
        <span className="numeric block truncate text-[14px] text-ink-muted" dir="ltr">
          {money(f.requestedAmount)}
        </span>
      ),
    },
    {
      key: 'stage',
      header: 'שלב',
      width: '0.9fr',
      render: (f) => (
        <Badge tone={labelOf(FILE_STAGE, f.stage).tone}>{labelOf(FILE_STAGE, f.stage).label}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'מצב',
      width: '0.8fr',
      render: (f) => (
        <Badge tone={labelOf(FILE_STATUS, f.status).tone}>
          {labelOf(FILE_STATUS, f.status).label}
        </Badge>
      ),
    },
    {
      key: 'urgency',
      header: 'דחיפות',
      width: '0.7fr',
      render: (f) => (
        <span className="text-[13.5px] text-ink-muted">{labelOf(URGENCY, f.urgency).label}</span>
      ),
    },
    {
      key: 'next',
      header: 'יעד הפעולה הבאה',
      width: '0.9fr',
      render: (f) => (
        <span
          className={cn(
            'numeric block truncate text-[13.5px]',
            f.nextActionDate && new Date(f.nextActionDate) < new Date()
              ? 'text-urgent-ink'
              : 'text-ink-subtle',
          )}
          dir="ltr"
        >
          {date(f.nextActionDate)}
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'עודכן',
      width: '0.7fr',
      render: (f) => <span className="text-[13.5px] text-ink-subtle">{relative(f.updatedAt)}</span>,
    },
  ]

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair px-7 py-5">
          <div>
            <h1 className="font-heading text-[32px] font-bold leading-tight text-ink">
              תיקי משכנתא
            </h1>
            {data && (
              <p className="mt-1 text-[15px] text-ink-muted">
                <span className="numeric" dir="ltr">
                  {data.total}
                </span>{' '}
                תיקים
              </p>
            )}
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            תיק חדש
          </Button>
        </div>

        <FilterBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="חיפוש לפי מספר תיק, לקוח או כתובת…"
          />
          <FilterSelect
            value={stage}
            onChange={(v) => setParam('stage', v)}
            options={options(FILE_STAGE)}
            placeholder="שלב"
          />
          <FilterSelect
            value={status}
            onChange={(v) => setParam('status', v)}
            options={options(FILE_STATUS)}
            placeholder="מצב התיק"
          />
          {stage && (
            <ActiveFilterChip
              label={`שלב: ${labelOf(FILE_STAGE, stage).label}`}
              onClear={() => setParam('stage', '')}
            />
          )}
          {status && (
            <ActiveFilterChip
              label={`מצב: ${labelOf(FILE_STATUS, status).label}`}
              onClear={() => setParam('status', '')}
            />
          )}
        </FilterBar>

        {error ? (
          <ErrorState message="לא הצלחנו לטעון את התיקים." onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton cols={8} />
        ) : !data?.items.length ? (
          <EmptyState
            icon={<FolderOpen className="size-7" />}
            title={filtered ? 'לא נמצאו תיקים בסינון הזה' : 'אין עדיין תיקים'}
            description={
              filtered
                ? 'הסינון הנוכחי לא החזיר תוצאות. נקה אותו כדי לראות את כל התיקים.'
                : 'תיק מרכז את כל מה שקשור לעסקה אחת — מסמכים, משימות ובקשות לבנק.'
            }
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('')
                    setParams(new URLSearchParams(), { replace: true })
                  }}
                >
                  נקה מסננים
                </Button>
              ) : (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="size-4" />
                  תיק חדש
                </Button>
              )
            }
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data.items}
              toneOf={(f) => labelOf(FILE_STATUS, f.status).tone}
              linkTo={(f) => `/files/${f.id}`}
              minWidth={1100}
            />
            <TableFooter
              shown={data.items.length}
              total={data.total}
              hint="לחיצה על שורה פותחת את דף התיק"
            />
          </>
        )}
      </Card>

      <NewFileModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

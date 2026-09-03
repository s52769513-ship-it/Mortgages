import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { api, qs } from '@/api/client'
import { cn } from '@/lib/cn'
import { date } from '@/lib/format'
import { DOCUMENT_STATUS, labelOf, options } from '@/lib/labels'
import type { Doc } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/Field'
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

type Scope = 'all' | 'outstanding'

/** The two decisions a reviewer makes most often, straight from the row. */
function ReviewActions({ doc }: { doc: Doc }) {
  const { notify } = useToast()
  const queryClient = useQueryClient()

  const setStatus = useMutation({
    mutationFn: (status: string) => api.patch<Doc>(`/documents/${doc.id}`, { status }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['file'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify(`${updated.docType} — ${labelOf(DOCUMENT_STATUS, updated.status).label}`)
    },
    onError: (e: Error) => notify('עדכון המסמך נכשל', { tone: 'error', detail: e.message }),
  })

  if (doc.status === 'APPROVED') return null

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        loading={setStatus.isPending && setStatus.variables === 'APPROVED'}
        loadingLabel="…"
        onClick={() => setStatus.mutate('APPROVED')}
      >
        אשר
      </Button>
      <Button
        size="sm"
        variant="secondary"
        loading={setStatus.isPending && setStatus.variables === 'INVALID'}
        loadingLabel="…"
        onClick={() => setStatus.mutate('INVALID')}
      >
        סמן לא תקין
      </Button>
    </>
  )
}

export function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [scope, setScope] = useState<Scope>('all')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['documents', search, status, scope],
    queryFn: () =>
      api.get<{ items: Doc[]; total: number }>(
        `/documents${qs({ q: search, status, outstanding: scope === 'outstanding' ? '1' : '' })}`,
      ),
  })

  const filtered = Boolean(search || status || scope !== 'all')

  const columns: Column<Doc>[] = [
    {
      key: 'type',
      header: 'סוג המסמך',
      width: '1.5fr',
      render: (d) => (
        <>
          <span className="block truncate text-[15px] font-medium text-ink">{d.docType}</span>
          {d.issueNotes && (
            <span className="block truncate text-[13px] text-urgent-ink">{d.issueNotes}</span>
          )}
        </>
      ),
    },
    {
      key: 'file',
      header: 'תיק',
      width: '1.1fr',
      render: (d) => (
        <>
          <span className="numeric block truncate text-[13.5px] text-steel-700" dir="ltr">
            {d.file?.fileNumber ?? '—'}
          </span>
          <span className="block truncate text-[13px] text-ink-muted">
            {d.file?.client.fullName}
          </span>
        </>
      ),
    },
    {
      key: 'status',
      header: 'סטטוס',
      width: '0.9fr',
      render: (d) => (
        <Badge tone={labelOf(DOCUMENT_STATUS, d.status).tone}>
          {labelOf(DOCUMENT_STATUS, d.status).label}
        </Badge>
      ),
    },
    {
      key: 'version',
      header: 'גרסה',
      width: '0.5fr',
      render: (d) => (
        <span className="numeric text-[14px] text-ink-muted" dir="ltr">
          {d.version}
        </span>
      ),
    },
    {
      key: 'received',
      header: 'התקבל',
      width: '0.7fr',
      render: (d) => (
        <span className="numeric block text-[13.5px] text-ink-subtle" dir="ltr">
          {date(d.receivedAt)}
        </span>
      ),
    },
    {
      key: 'expires',
      header: 'תפוגה',
      width: '0.7fr',
      render: (d) => {
        const expired = d.expiresAt && new Date(d.expiresAt) < new Date()
        return (
          <span
            className={cn(
              'numeric block text-[13.5px]',
              expired ? 'font-medium text-urgent-ink' : 'text-ink-subtle',
            )}
            dir="ltr"
          >
            {date(d.expiresAt)}
          </span>
        )
      },
    },
    {
      key: 'bank',
      header: 'לחבילת הבנק',
      width: '0.8fr',
      render: (d) =>
        d.allowedForBank ? (
          <span className="text-[13.5px] text-ok-ink">מאושר</span>
        ) : (
          <span className="text-[13.5px] text-ink-subtle">לא</span>
        ),
    },
  ]

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair px-7 py-5">
        <div>
          <h1 className="font-heading text-[32px] font-bold leading-tight text-ink">מסמכים</h1>
          {data && (
            <p className="mt-1 text-[15px] text-ink-muted">
              <span className="numeric" dir="ltr">
                {data.total}
              </span>{' '}
              מסמכים בכל התיקים
            </p>
          )}
        </div>
        <div className="w-56">
          <SegmentedControl
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: 'הכל' },
              { value: 'outstanding', label: 'ממתינים' },
            ]}
          />
        </div>
      </div>

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="חיפוש לפי סוג מסמך, תיק או לקוח…"
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={options(DOCUMENT_STATUS)}
          placeholder="סטטוס"
        />
        {status && (
          <ActiveFilterChip
            label={`סטטוס: ${labelOf(DOCUMENT_STATUS, status).label}`}
            onClear={() => setStatus('')}
          />
        )}
      </FilterBar>

      {error ? (
        <ErrorState message="לא הצלחנו לטעון את המסמכים." onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton cols={7} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={<FileText className="size-7" />}
          tone={scope === 'outstanding' ? 'ok' : 'neutral'}
          title={
            scope === 'outstanding'
              ? 'אין מסמכים שממתינים לטיפול'
              : filtered
                ? 'לא נמצאו מסמכים בסינון הזה'
                : 'אין עדיין מסמכים'
          }
          description={
            scope === 'outstanding'
              ? 'כל המסמכים שנדרשו התקבלו ואושרו.'
              : filtered
                ? 'הסינון הנוכחי לא החזיר תוצאות. אפשר לנקות אותו ולראות את כל המסמכים.'
                : 'מסמכים נוספים מתוך דף התיק, ומרוכזים כאן על פני כל התיקים.'
          }
          action={
            filtered && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('')
                  setStatus('')
                  setScope('all')
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
            toneOf={(d) => labelOf(DOCUMENT_STATUS, d.status).tone}
            rowActions={(d) => <ReviewActions doc={d} />}
            minWidth={1080}
          />
          <TableFooter
            shown={data.items.length}
            total={data.total}
            hint="ריחוף על שורה חושף אישור או סימון כלא תקין"
          />
        </>
      )}
    </Card>
  )
}

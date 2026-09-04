import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, KanbanSquare, Plus, Rows3, Trash2 } from 'lucide-react'
import { api, qs } from '@/api/client'
import { cn } from '@/lib/cn'
import { date, money, relative } from '@/lib/format'
import { FILE_STAGE, FILE_STATUS, labelOf, options, URGENCY, type Stage } from '@/lib/labels'
import type { MortgageFile } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States'
import { NewFileModal } from '@/components/NewFileModal'
import { PipelineBoard } from '@/components/PipelineBoard'
import { useListing } from '@/lib/useListing'
import { useHiddenColumns, useSavedViews, type SavedView } from '@/lib/useTableViews'
import { BulkBar, BulkSelect, ColumnsMenu, SavedViewsMenu } from '@/components/TableToolbar'
import {
  ActiveFilterChip,
  Column,
  DataTable,
  FilterBar,
  FilterSelect,
  SearchInput,
  TableFooter,
} from '@/components/DataTable'

type Mode = 'table' | 'board'

/** What a saved view remembers. Paging is deliberately not part of it. */
type ViewState = { search: string; stage: string; status: string; urgency: string; mode: Mode }

/** The board needs the whole pipeline at once, not one page of it. 200 is the
 *  server's ceiling for a single listing request. */
const BOARD_LIMIT = 200

/** The two columns that identify the row; hiding them would leave it unreadable. */
const LOCKED_COLUMNS = ['number', 'client']

export function FilesPage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const { notify } = useToast()

  const stage = params.get('stage') ?? ''
  const status = params.get('status') ?? ''
  const urgency = params.get('urgency') ?? ''
  const mode: Mode = params.get('view') === 'board' ? 'board' : 'table'

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  // The mobile FAB opens this screen with ?new=1.
  useEffect(() => {
    if (!params.get('new')) return
    setCreating(true)
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }, [params, setParams])

  const listing = useListing(`${search}|${stage}|${status}|${urgency}|${mode}`)
  const columnPrefs = useHiddenColumns('files', LOCKED_COLUMNS)

  // A selection that outlives the filter it was made under is a trap.
  useEffect(() => {
    setSelected([])
  }, [search, stage, status, urgency, listing.page])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['files', search, stage, status, urgency, mode, listing.params],
    queryFn: () =>
      api.get<{ items: MortgageFile[]; total: number }>(
        `/files${qs({
          q: search,
          stage,
          status,
          urgency,
          ...(mode === 'board' ? { take: BOARD_LIMIT, skip: 0 } : listing.params),
        })}`,
      ),
  })

  // ---- saved views -------------------------------------------------------

  const current: ViewState = { search, stage, status, urgency, mode }
  const views = useSavedViews<ViewState>('files')
  const activeView = views.views.find((v) => v.id === views.activeId)
  const dirty = Boolean(activeView) && JSON.stringify(activeView!.state) !== JSON.stringify(current)

  const applyView = (view: SavedView<ViewState>) => {
    setSearch(view.state.search)
    const next = new URLSearchParams()
    if (view.state.stage) next.set('stage', view.state.stage)
    if (view.state.status) next.set('status', view.state.status)
    if (view.state.urgency) next.set('urgency', view.state.urgency)
    if (view.state.mode === 'board') next.set('view', 'board')
    setParams(next, { replace: true })
    views.setActiveId(view.id)
    setSelected([])
  }

  const clearFilters = () => {
    setSearch('')
    const next = new URLSearchParams()
    if (mode === 'board') next.set('view', 'board')
    setParams(next, { replace: true })
    views.setActiveId(null)
  }

  // ---- writes ------------------------------------------------------------

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['files'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const move = useMutation({
    mutationFn: ({ id, stage: to }: { id: string; stage: Stage }) =>
      api.patch(`/files/${id}`, { stage: to }),
    onMutate: ({ id }) => {
      setMovingId(id)
    },
    onSettled: () => setMovingId(null),
    onSuccess: (_result, { stage: to }) => {
      invalidate()
      notify('התיק הועבר', { detail: `שלב חדש: ${labelOf(FILE_STAGE, to).label}` })
    },
    onError: (e: Error) => notify('העברת התיק נכשלה', { tone: 'error', detail: e.message }),
  })

  /**
   * Applies an operation to each selected file in turn and reports what
   * actually happened. Stopping at the first error would leave the office
   * looking at a failure message with half the batch already written.
   *
   * Sequential on purpose: each write records its own activity entry, and a
   * burst of parallel writes would interleave them into nonsense.
   */
  const runOnSelection = async (act: (id: string) => Promise<unknown>) => {
    let done = 0
    const failed: string[] = []
    for (const id of selected) {
      try {
        await act(id)
        done += 1
      } catch (e) {
        failed.push(e instanceof Error ? e.message : String(e))
      }
    }
    return { done, failed }
  }

  const report = (verb: string, done: number, failed: string[]) => {
    invalidate()
    if (!failed.length) {
      notify(verb, { detail: `${done} תיקים` })
      setSelected([])
      return
    }
    // Anything that failed stays on screen: an error toast does not
    // auto-dismiss, and a half-applied batch is worth reading.
    notify(`${verb} — ${failed.length} נכשלו`, {
      tone: 'error',
      detail: `${done} הצליחו · ${failed[0]}`,
    })
  }

  const bulk = useMutation({
    mutationFn: ({ patch }: { patch: Record<string, string>; label: string }) =>
      runOnSelection((id) => api.patch(`/files/${id}`, patch)),
    onSuccess: ({ done, failed }, { label }) => report(label, done, failed),
    onError: (e: Error) => {
      invalidate()
      notify('העדכון המרובה נכשל', { tone: 'error', detail: e.message })
    },
  })

  const bulkDelete = useMutation({
    mutationFn: () => runOnSelection((id) => api.delete(`/files/${id}`)),
    onSuccess: ({ done, failed }) => {
      setConfirmingDelete(false)
      report('התיקים נמחקו', done, failed)
    },
    onError: (e: Error) => {
      invalidate()
      notify('המחיקה נכשלה', { tone: 'error', detail: e.message })
    },
  })

  const busy = bulk.isPending || bulkDelete.isPending

  // ---- columns -----------------------------------------------------------

  const allColumns: Column<MortgageFile>[] = useMemo(
    () => [
      {
        key: 'number',
        header: 'מספר תיק',
        width: '1.1fr',
        sortKey: 'fileNumber',
        render: (f) => (
          <span
            className="numeric block truncate text-[14px] font-semibold text-steel-700"
            dir="ltr"
          >
            {f.fileNumber}
          </span>
        ),
      },
      {
        key: 'client',
        header: 'לקוח',
        width: '1.4fr',
        sortKey: 'client.fullName',
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
        sortKey: 'requestedAmount',
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
        sortKey: 'stage',
        render: (f) => (
          <Badge tone={labelOf(FILE_STAGE, f.stage).tone}>
            {labelOf(FILE_STAGE, f.stage).label}
          </Badge>
        ),
      },
      {
        key: 'status',
        header: 'מצב',
        width: '0.8fr',
        sortKey: 'status',
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
        sortKey: 'urgency',
        render: (f) => (
          <span className="text-[13.5px] text-ink-muted">{labelOf(URGENCY, f.urgency).label}</span>
        ),
      },
      {
        key: 'owner',
        header: 'אחראי',
        width: '0.8fr',
        render: (f) => (
          <span className="block truncate text-[13.5px] text-ink-muted">{f.owner?.name ?? '—'}</span>
        ),
      },
      {
        key: 'next',
        header: 'יעד הפעולה הבאה',
        width: '0.9fr',
        sortKey: 'nextActionDate',
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
        sortKey: 'updatedAt',
        render: (f) => (
          <span className="text-[13.5px] text-ink-subtle">{relative(f.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const columns = allColumns.filter((c) => !columnPrefs.isHidden(c.key))
  const filtered = Boolean(search || stage || status || urgency)

  const setMode = (next: Mode) => {
    setSelected([])
    setParam('view', next === 'board' ? 'board' : '')
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair px-5 py-5 lg:px-7">
          <div>
            <h1 className="font-heading text-[26px] font-bold leading-tight text-ink sm:text-[32px]">
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

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="תצוגת הרשימה"
              className="flex items-center rounded-md border border-field p-0.5"
            >
              {(
                [
                  { value: 'table', label: 'טבלה', icon: Rows3 },
                  { value: 'board', label: 'צנרת', icon: KanbanSquare },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-[13.5px]',
                    'transition-colors duration-micro ease-standard',
                    mode === value
                      ? 'bg-steel-600 font-medium text-white'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            <Button className="hidden sm:inline-flex" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              תיק חדש
            </Button>
          </div>
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
          <FilterSelect
            value={urgency}
            onChange={(v) => setParam('urgency', v)}
            options={options(URGENCY)}
            placeholder="דחיפות"
          />

          <div className="ms-auto flex items-center gap-3">
            <SavedViewsMenu
              views={views.views}
              activeId={views.activeId}
              dirty={dirty}
              onApply={applyView}
              onSave={(name) => views.save(name, current)}
              onDelete={views.remove}
            />
            {mode === 'table' && (
              <ColumnsMenu
                columns={allColumns.map((c) => ({ key: c.key, header: c.header }))}
                hidden={columnPrefs.hidden}
                onToggle={columnPrefs.toggle}
                onReset={columnPrefs.reset}
                locked={LOCKED_COLUMNS}
              />
            )}
          </div>

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
          {urgency && (
            <ActiveFilterChip
              label={`דחיפות: ${labelOf(URGENCY, urgency).label}`}
              onClear={() => setParam('urgency', '')}
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
                <Button variant="secondary" onClick={clearFilters}>
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
        ) : mode === 'board' ? (
          <>
            <PipelineBoard
              files={data.items}
              movingId={movingId}
              onMove={(id, to) => move.mutate({ id, stage: to })}
            />
            {data.total > data.items.length && (
              <p className="border-t border-hair px-5 py-3 text-[13px] text-ink-muted lg:px-7">
                הלוח מציג {data.items.length} תיקים מתוך {data.total}. סנן כדי לצמצם את התמונה.
              </p>
            )}
          </>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data.items}
              toneOf={(f) => labelOf(FILE_STATUS, f.status).tone}
              linkTo={(f) => `/files/${f.id}`}
              minWidth={1100}
              sort={listing.sort}
              onSort={listing.setSort}
              selected={selected}
              onSelect={setSelected}
            />

            <BulkBar count={selected.length} busy={busy} onClear={() => setSelected([])}>
              <BulkSelect
                label="שינוי שלב"
                options={options(FILE_STAGE)}
                onPick={(value) => bulk.mutate({ patch: { stage: value }, label: 'השלב עודכן' })}
              />
              <BulkSelect
                label="שינוי מצב"
                options={options(FILE_STATUS)}
                onPick={(value) =>
                  bulk.mutate({ patch: { status: value }, label: 'מצב התיקים עודכן' })
                }
              />
              <BulkSelect
                label="שינוי דחיפות"
                options={options(URGENCY)}
                onPick={(value) =>
                  bulk.mutate({ patch: { urgency: value }, label: 'הדחיפות עודכנה' })
                }
              />
              <Button size="sm" variant="danger" onClick={() => setConfirmingDelete(true)}>
                <Trash2 className="size-4" />
                מחיקה
              </Button>
            </BulkBar>

            <TableFooter
              shown={data.items.length}
              total={data.total}
              page={listing.page}
              pageSize={listing.pageSize}
              onPage={listing.setPage}
              hint="לחיצה על שורה פותחת את דף התיק"
            />

            {confirmingDelete && (
              <Modal
                open
                onClose={() => setConfirmingDelete(false)}
                title={`מחיקת ${selected.length} תיקים`}
                description="הפעולה אינה הפיכה."
                footer={
                  <>
                    <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                      בטל
                    </Button>
                    <Button
                      variant="danger"
                      loading={bulkDelete.isPending}
                      loadingLabel="מוחק…"
                      onClick={() => bulkDelete.mutate()}
                    >
                      מחק לצמיתות
                    </Button>
                  </>
                }
              >
                <div className="space-y-4">
                  <p className="text-[14.5px] leading-relaxed text-ink">
                    מחיקת תיק מוחקת איתו גם את כל מה שתלוי בו — המשימות, המסמכים
                    והקבצים שהועלו, הבקשות לבנקים, רישומי התקשורת וההוצאות.
                  </p>
                  <ul className="max-h-52 divide-y divide-row overflow-y-auto rounded-md border border-row">
                    {data.items
                      .filter((f) => selected.includes(f.id))
                      .map((f) => (
                        <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-[14px]">
                          <span className="numeric shrink-0 text-[12.5px] text-ink-subtle" dir="ltr">
                            {f.fileNumber}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{f.client?.fullName}</span>
                        </li>
                      ))}
                  </ul>
                  {selected.some((id) => !data.items.some((f) => f.id === id)) && (
                    <p className="text-[13px] text-ink-muted">
                      חלק מהתיקים המסומנים נבחרו בעמודים אחרים ואינם ברשימה כאן.
                    </p>
                  )}
                </div>
              </Modal>
            )}
          </>
        )}
      </Card>

      <NewFileModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

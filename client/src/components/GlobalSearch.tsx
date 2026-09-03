import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, FolderOpen, Loader2, Search, Users } from 'lucide-react'
import { api, qs } from '@/api/client'
import { cn } from '@/lib/cn'
import { FILE_STAGE, labelOf, LEAD_STATUS, DOCUMENT_STATUS } from '@/lib/labels'
import { Badge } from '@/components/ui/Badge'

type Results = {
  clients: { id: string; fullName: string; phone: string; leadStatus: string }[]
  files: {
    id: string
    fileNumber: string
    stage: string
    propertyAddress: string | null
    client: { fullName: string }
  }[]
  documents: {
    id: string
    docType: string
    status: string
    seq: number
    fileId: string
    file: { fileNumber: string; client: { fullName: string } } | null
  }[]
}

/** Waits for typing to settle before asking the server. */
function useDebounced(value: string, ms: number) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const query = useDebounced(term.trim(), 250)

  const { data, isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.get<Results>(`/search${qs({ q: query })}`),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const go = (to: string) => {
    setOpen(false)
    setTerm('')
    navigate(to)
  }

  const groups = [
    {
      key: 'files',
      label: 'תיקים',
      icon: <FolderOpen className="size-3.5" />,
      rows: (data?.files ?? []).map((f) => ({
        id: f.id,
        to: `/files/${f.id}`,
        title: f.client.fullName,
        meta: f.propertyAddress ?? '',
        lead: f.fileNumber,
        badge: labelOf(FILE_STAGE, f.stage),
      })),
    },
    {
      key: 'clients',
      label: 'לקוחות',
      icon: <Users className="size-3.5" />,
      rows: (data?.clients ?? []).map((c) => ({
        id: c.id,
        to: `/clients/${c.id}`,
        title: c.fullName,
        meta: c.phone,
        lead: null,
        badge: labelOf(LEAD_STATUS, c.leadStatus),
      })),
    },
    {
      key: 'documents',
      label: 'מסמכים',
      icon: <FileText className="size-3.5" />,
      rows: (data?.documents ?? []).map((d) => ({
        id: d.id,
        to: `/files/${d.fileId}`,
        title: d.docType,
        meta: d.file ? `${d.file.fileNumber} · ${d.file.client.fullName}` : '',
        lead: null,
        badge: labelOf(DOCUMENT_STATUS, d.status),
      })),
    },
  ].filter((g) => g.rows.length > 0)

  const searched = query.length >= 2
  const empty = searched && !isFetching && groups.length === 0

  return (
    <div className="relative hidden min-w-0 max-w-sm flex-1 sm:block" ref={wrapRef}>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle">
        {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
      </span>
      <input
        type="search"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="חיפוש תיק, לקוח או מסמך…"
        className={cn(
          'h-10 w-full rounded-md border border-field bg-surface pe-3 ps-9 text-[15px]',
          'placeholder:text-ink-faint transition-colors duration-micro ease-standard',
          'focus:border-steel-600',
        )}
      />

      {open && searched && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[420px] max-w-[90vw] overflow-hidden rounded-lg border border-hair bg-surface shadow-modal animate-overlay-in">
          {empty ? (
            <p className="px-4 py-6 text-center text-[13.5px] text-ink-muted">
              לא נמצא כלום עבור «{query}».
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-1.5 border-b border-hair bg-paper px-4 py-1.5 text-[11.5px] font-semibold text-ink-muted">
                    {group.icon}
                    {group.label}
                  </div>
                  <ul className="divide-y divide-row">
                    {group.rows.map((row) => (
                      <li key={row.id}>
                        <button
                          onClick={() => go(row.to)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-right transition-colors duration-micro hover:bg-ink/[0.04]"
                        >
                          {row.lead && (
                            <span
                              className="numeric shrink-0 text-[13px] font-semibold text-steel-700"
                              dir="ltr"
                            >
                              {row.lead}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium text-ink">
                              {row.title}
                            </span>
                            {row.meta && (
                              <span className="block truncate text-[12.5px] text-ink-muted">
                                {row.meta}
                              </span>
                            )}
                          </span>
                          <Badge tone={row.badge.tone}>{row.badge.label}</Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  FileText,
  FolderOpen,
  Home,
  ListChecks,
  Loader2,
  Search,
  Users,
} from 'lucide-react'
import { api, qs } from '@/api/client'
import { cn } from '@/lib/cn'
import { labelOf, FILE_STAGE, LEAD_STATUS, DOCUMENT_STATUS } from '@/lib/labels'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import type { Entry } from '@/lib/labels'
import type { LucideIcon } from 'lucide-react'

type Item = {
  id: string
  to: string
  title: string
  meta: string
  icon: LucideIcon
  badge: Entry | null
}

type Group = {
  key: string
  label: string
  items: Item[]
}

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

const NAV_COMMANDS = [
  { id: 'dashboard', label: 'דשבורד', to: '/', icon: Home },
  { id: 'clients', label: 'לקוחות ולידים', to: '/clients', icon: Users },
  { id: 'files', label: 'תיקי משכנתא', to: '/files', icon: FolderOpen },
  { id: 'tasks', label: 'משימות', to: '/tasks', icon: ListChecks },
  { id: 'documents', label: 'מסמכים', to: '/documents', icon: FileText },
  { id: 'bank-applications', label: 'בקשות לבנק', to: '/bank-applications', icon: Building2 },
]

function useDebounced(value: string, ms: number) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const query = useDebounced(term.trim(), 200)

  const { data, isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.get<Results>(`/search${qs({ q: query })}`),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })

  const isSearching = query.length >= 2

  const groups: Group[] = useMemo(() => {
    if (!isSearching) {
      return [
        {
          key: 'nav',
          label: 'ניווט מהיר',
          items: NAV_COMMANDS.map((cmd) => ({
            id: cmd.id,
            to: cmd.to,
            title: cmd.label,
            meta: '',
            icon: cmd.icon,
            badge: null,
          })),
        },
      ]
    }

    return [
      {
        key: 'files',
        label: 'תיקים',
        items: (data?.files ?? []).map((f) => ({
          id: f.id,
          to: `/files/${f.id}`,
          title: f.client.fullName,
          meta: f.propertyAddress ?? '',
          icon: FolderOpen,
          badge: labelOf(FILE_STAGE, f.stage),
        })),
      },
      {
        key: 'clients',
        label: 'לקוחות',
        items: (data?.clients ?? []).map((c) => ({
          id: c.id,
          to: `/clients/${c.id}`,
          title: c.fullName,
          meta: c.phone,
          icon: Users,
          badge: labelOf(LEAD_STATUS, c.leadStatus),
        })),
      },
      {
        key: 'documents',
        label: 'מסמכים',
        items: (data?.documents ?? []).map((d) => ({
          id: d.id,
          to: `/files/${d.fileId}`,
          title: d.docType,
          meta: d.file ? `${d.file.fileNumber} · ${d.file.client.fullName}` : '',
          icon: FileText,
          badge: labelOf(DOCUMENT_STATUS, d.status),
        })),
      },
    ].filter((g) => g.items.length > 0)
  }, [data, isSearching])

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups])

  useEffect(() => {
    if (open) {
      setTerm('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [term, groups.length])

  const go = (to: string) => {
    navigate(to)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % flatItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + flatItems.length) % flatItems.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatItems[selectedIndex]
        if (item) go(item.to)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, flatItems, selectedIndex, onClose])

  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  let itemIndex = -1

  return (
    <Modal open={open} onClose={onClose} size="md" aria-label="פקודות מהירות וחיפוש">
      <div className="flex items-center gap-3 border-b border-hair px-4 py-3">
        {isFetching ? (
          <Loader2 className="size-5 animate-spin text-ink-subtle" />
        ) : (
          <Search className="size-5 text-ink-subtle" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="חפש לקוח, תיק, מסמך או עבור למסך…"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <kbd className="hidden rounded-md border border-field bg-paper px-2 py-0.5 text-[12px] text-ink-subtle sm:block">
          ESC
        </kbd>
      </div>

      <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
        {isSearching && !isFetching && groups.length === 0 && (
          <p className="px-4 py-6 text-center text-[14px] text-ink-muted">
            לא נמצאו תוצאות עבור «{query}».
          </p>
        )}

        {groups.map((group) => (
          <div key={group.key}>
            <div className="px-4 py-1.5 text-[11.5px] font-semibold text-ink-subtle">
              {group.label}
            </div>
            <ul>
              {group.items.map((item) => {
                itemIndex++
                const isSelected = itemIndex === selectedIndex
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => go(item.to)}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      data-selected={isSelected}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-right transition-colors duration-micro',
                        isSelected ? 'bg-steel-100' : 'hover:bg-ink/[0.04]',
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-ink-subtle" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-medium text-ink">
                          {item.title}
                        </span>
                        {item.meta && (
                          <span className="block truncate text-[12.5px] text-ink-muted">
                            {item.meta}
                          </span>
                        )}
                      </span>
                      {item.badge && <Badge tone={item.badge.tone}>{item.badge.label}</Badge>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-hair px-4 py-2 text-[11.5px] text-ink-subtle">
        <span>↑↓ לניווט · Enter לבחירה · Esc לסגירה</span>
        <span>Ctrl+K לפתיחה</span>
      </div>
    </Modal>
  )
}

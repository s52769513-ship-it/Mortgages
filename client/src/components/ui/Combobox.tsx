import { useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { api, qs } from '@/api/client'
import { cn } from '@/lib/cn'

export type ComboOption = { id: string; label: string; hint?: string }

/**
 * Picks from a list the server holds, without forcing the list to be complete.
 * The office's bank and branch lists come from the official published data, but
 * a banker is a personal contact who will never appear in any dataset — so
 * whatever is typed stands on its own and is created on save.
 */
export function Combobox({
  label,
  value,
  onChange,
  endpoint,
  disabled,
  disabledHint,
  placeholder,
  required,
  hint,
  error,
}: {
  label: string
  /** The chosen row when one was picked, otherwise just the typed text. */
  value: { id: string | null; text: string }
  onChange: (value: { id: string | null; text: string }) => void
  /** Query endpoint, called with ?q=… — omit to disable lookups entirely. */
  endpoint: string | null
  disabled?: boolean
  disabledHint?: string
  placeholder?: string
  required?: boolean
  hint?: string
  error?: string
}) {
  const fieldId = useId()
  const listId = `${fieldId}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { data: options, isFetching } = useQuery({
    queryKey: ['combobox', endpoint, value.text],
    queryFn: () => api.get<ComboOption[]>(`${endpoint}${qs({ q: value.text })}`),
    enabled: Boolean(endpoint) && open && !disabled,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const list = options ?? []
  const showList = open && !disabled && (list.length > 0 || isFetching)

  const choose = (option: ComboOption) => {
    onChange({ id: option.id, text: option.label })
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return setOpen(false)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      setActive((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1
        return Math.max(0, Math.min(list.length - 1, next))
      })
    }
    if (e.key === 'Enter' && open && list[active]) {
      e.preventDefault()
      choose(list[active])
    }
  }

  return (
    <div className="space-y-1.5" ref={wrapRef}>
      <label htmlFor={fieldId} className={cn('block text-[12px] font-semibold', error ? 'text-urgent' : 'text-ink-muted')}>
        {label}
        {required && <span aria-hidden> *</span>}
      </label>

      <div className="relative">
        <input
          id={fieldId}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={value.text}
          onChange={(e) => {
            // Typing past a chosen row means it is no longer that row.
            onChange({ id: null, text: e.target.value })
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-11 w-full rounded-md border border-field bg-surface pe-9 ps-3 text-[15px] text-ink md:h-10',
            'placeholder:text-ink-faint transition-colors duration-micro ease-standard',
            'focus:border-steel-600',
            'disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-subtle',
            error && 'border-urgent',
          )}
        />

        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-subtle">
          {isFetching ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
        </span>

        {showList && (
          <ul
            id={listId}
            role="listbox"
            className={cn(
              'absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-hair',
              'bg-surface py-1 shadow-modal animate-fade-in',
            )}
          >
            {list.map((option, i) => (
              <li key={option.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(option)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-right text-[14px]',
                    'transition-colors duration-micro ease-standard',
                    i === active ? 'bg-busy-tint text-busy-ink' : 'text-ink',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.hint && (
                    <span className="numeric shrink-0 text-[12.5px] text-ink-subtle" dir="ltr">
                      {option.hint}
                    </span>
                  )}
                  {value.id === option.id && <Check className="size-4 shrink-0 text-steel-600" />}
                </button>
              </li>
            ))}
            {!list.length && isFetching && (
              <li className="px-3 py-2 text-[13.5px] text-ink-subtle">מחפש…</li>
            )}
          </ul>
        )}
      </div>

      {error ? (
        <p className="text-[12px] text-urgent-ink">{error}</p>
      ) : disabled && disabledHint ? (
        <p className="text-[12px] text-ink-subtle">{disabledHint}</p>
      ) : hint ? (
        <p className="text-[12px] text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

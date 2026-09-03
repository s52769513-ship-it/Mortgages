import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type Tab = { id: string; label: string; count?: number }

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn('flex gap-7 overflow-x-auto border-b border-hair px-7', className)}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-[3px] py-4 text-[15px]',
              'transition-colors duration-micro ease-standard',
              selected
                ? 'border-steel-600 font-semibold text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="numeric text-[13px] text-ink-subtle" dir="ltr">
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({
  when,
  active,
  className,
  children,
}: {
  when: string
  active: string
  className?: string
  children: ReactNode
}) {
  if (when !== active) return null
  return (
    <div role="tabpanel" className={cn('animate-fade-in', className)}>
      {children}
    </div>
  )
}

/** Label on one side, value on the other — the side-rail fact rows. */
export function FactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-[13px] text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-left text-[14px] font-medium text-ink">{value ?? '—'}</dd>
    </div>
  )
}

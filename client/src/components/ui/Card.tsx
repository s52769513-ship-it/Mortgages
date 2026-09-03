import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-row bg-surface shadow-raised', className)}
      {...rest}
    />
  )
}

/** Barlow eyebrow → Heebo title → muted meta, per the card anatomy. */
export function CardHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-hair px-6 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="eyebrow mb-1 text-[12px] text-steel-600" dir="ltr">
            {eyebrow}
          </p>
        )}
        <h2 className="truncate font-heading text-[20px] font-medium text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5', className)} {...rest} />
}

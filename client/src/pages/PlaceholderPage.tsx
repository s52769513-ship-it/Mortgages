import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'

/**
 * Routes reachable from the sidebar whose list screens land in a later slice.
 * The nav stays honest rather than dead-ending on a blank page.
 */
export function PlaceholderPage({
  title,
  icon,
  description,
}: {
  title: string
  icon: ReactNode
  description: string
}) {
  return (
    <>
      <h1 className="mb-6 font-heading text-[32px] font-bold leading-tight text-ink">{title}</h1>
      <Card>
        <EmptyState icon={icon} title="המסך הזה עדיין בבנייה" description={description} />
      </Card>
    </>
  )
}

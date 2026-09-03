import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'
import { date, money, percent } from '@/lib/format'
import { BANK_APP_STATUS, labelOf } from '@/lib/labels'
import type { BankApplication } from '@/types'
import { Badge, RAILS } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-ink-subtle">{label}</dt>
      <dd className={cn('truncate text-[14px] font-medium', tone ?? 'text-ink')}>{value}</dd>
    </div>
  )
}

/**
 * One row per application rather than a column each: a file is often submitted
 * to several banks, and columns stop being readable past two or three. The
 * chosen offer is marked and sorted to the top.
 */
export function BankApplicationRows({
  applications,
  fileId,
}: {
  applications: BankApplication[]
  fileId: string
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()

  const choose = useMutation({
    mutationFn: ({ id, isChosen }: { id: string; isChosen: boolean }) =>
      api.patch<BankApplication>(`/bank-applications/${id}`, { isChosen }),
    onSuccess: (application) => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] })
      queryClient.invalidateQueries({ queryKey: ['bank-applications'] })
      notify(
        application.isChosen
          ? `${application.bank?.name} סומן כבנק הנבחר`
          : 'הסימון הוסר',
      )
    },
    onError: (e: Error) => notify('הפעולה נכשלה', { tone: 'error', detail: e.message }),
  })

  return (
    <ul className="divide-y divide-row">
      {applications.map((app) => {
        const tone = labelOf(BANK_APP_STATUS, app.status).tone
        const validityDays = app.approvalValidUntil
          ? Math.floor((new Date(app.approvalValidUntil).getTime() - Date.now()) / 86_400_000)
          : null

        return (
          <li
            key={app.id}
            className={cn(
              'border-s-4 px-7 py-4 transition-colors duration-micro ease-standard',
              RAILS[tone],
              app.isChosen && 'bg-ok-tint/40',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[15px] font-semibold text-ink">{app.bank?.name}</span>
                  <Badge tone={tone}>{labelOf(BANK_APP_STATUS, app.status).label}</Badge>
                  {app.isChosen && (
                    <Badge tone="ok" dot>
                      הבנק הנבחר
                    </Badge>
                  )}
                </div>
                <p className="mt-1 truncate text-[13px] text-ink-muted">
                  {app.branch?.name ? `סניף ${app.branch.name}` : 'ללא סניף'}
                  {app.branch?.code && (
                    <>
                      {' '}
                      <span className="numeric" dir="ltr">
                        {app.branch.code}
                      </span>
                    </>
                  )}
                  {app.banker?.name && ` · ${app.banker.name}`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => choose.mutate({ id: app.id, isChosen: !app.isChosen })}
                disabled={choose.isPending}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium',
                  'transition-colors duration-micro ease-standard disabled:opacity-50',
                  app.isChosen
                    ? 'text-ok-ink hover:bg-ok-tint'
                    : 'text-ink-muted hover:bg-ink/[0.04] hover:text-ink',
                )}
              >
                <Star className={cn('size-4', app.isChosen && 'fill-current')} />
                {app.isChosen ? 'בטל בחירה' : 'בחר בנק זה'}
              </button>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
              <Fact label="סכום מבוקש" value={money(app.requestedAmount)} />
              <Fact label="אחוז מימון" value={percent(app.ltvPercent)} />
              <Fact label="ריבית מוצעת" value={app.offeredRates || '—'} />
              <Fact
                label="תוקף האישור"
                value={app.approvalValidUntil ? date(app.approvalValidUntil) : '—'}
                tone={
                  validityDays !== null && validityDays < 0
                    ? 'text-urgent-ink'
                    : validityDays !== null && validityDays <= 7
                      ? 'text-wait-ink'
                      : undefined
                }
              />
            </dl>

            {(app.missingItems || app.rejectionReason) && (
              <p
                className={cn(
                  'mt-3 rounded-md px-3 py-2 text-[13px]',
                  app.rejectionReason ? 'bg-urgent-tint text-urgent-ink' : 'bg-wait-tint text-wait-ink',
                )}
              >
                {app.rejectionReason ? `סיבת דחייה: ${app.rejectionReason}` : `חוסרים: ${app.missingItems}`}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'
import { relative } from '@/lib/format'
import type { Notification } from '@/types'

const POLL_MS = 15_000

/** Where a notification takes you when you open it. */
function routeFor(notification: Notification) {
  switch (notification.entityType) {
    case 'CLIENT':
      return `/clients/${notification.entityId}`
    case 'MORTGAGE_FILE':
      return `/files/${notification.entityId}`
    default:
      return null
  }
}

export function NotificationBell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ items: Notification[]; unread: number }>('/notifications'),
    refetchInterval: POLL_MS,
  })

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const markRead = useMutation({
    mutationFn: (id: string) => api.post<Notification>(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAll = useMutation({
    mutationFn: () => api.post<{ marked: number }>('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unread = data?.unread ?? 0
  const items = data?.items ?? []

  const openNotification = (notification: Notification) => {
    if (!notification.readAt) markRead.mutate(notification.id)
    const route = routeFor(notification)
    setOpen(false)
    if (route) navigate(route)
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `${unread} התראות שלא נקראו` : 'התראות'}
        className="relative rounded-md p-2 text-ink-muted transition-colors duration-micro hover:bg-ink/[0.04] hover:text-ink"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="numeric absolute -right-0.5 -top-0.5 flex min-w-[17px] items-center justify-center rounded-full bg-urgent px-1 text-[10.5px] font-semibold leading-[17px] text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-lg border border-hair bg-surface shadow-modal animate-overlay-in">
          <div className="flex items-center justify-between border-b border-hair px-4 py-2.5">
            <span className="text-[13px] font-semibold text-ink">התראות</span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-[12.5px] font-medium text-steel-700 hover:underline"
              >
                סמן הכל כנקרא
              </button>
            )}
          </div>

          {!items.length ? (
            <p className="px-4 py-8 text-center text-[13.5px] text-ink-muted">
              אין התראות. כשמישהו ישלח לך הודעה בכרטיס, היא תופיע כאן.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-row overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openNotification(n)}
                    className={cn(
                      'block w-full px-4 py-3 text-right transition-colors duration-micro',
                      'hover:bg-ink/[0.04]',
                      !n.readAt && 'bg-busy-tint/50',
                    )}
                  >
                    <span className="flex items-start gap-2">
                      {!n.readAt && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-steel-600" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium text-ink">
                          {n.actor?.name ?? 'המערכת'} כתב לך
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] text-ink-muted">
                          {n.preview}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] text-ink-subtle">
                          {relative(n.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

import { useSyncExternalStore } from 'react'
import type { QueryClient } from '@tanstack/react-query'

/**
 * The small "there's an update" tab at the bottom of the screen — two
 * different things can put it there, and neither gates anything on its own.
 *
 * A data change: a live-polled query (marked with `meta.live`, see
 * livePolling.ts) already refetches and re-renders on its own. This just
 * says so out loud, for the moment someone is looking at a screen and
 * something changed elsewhere — a quiet visual swap under someone's cursor
 * is easy to miss entirely. A save the viewer just made themselves does not
 * count as "someone else changed something": mutations are tracked
 * separately so the banner stays quiet for a few seconds after one.
 *
 * A new deploy: the code this tab is running is not what is live any more —
 * see versionCheck.ts. That one is worth more than a data blip (nothing new
 * gets fixed until the page reloads), so it is not auto-hidden and it is
 * never bumped by a data announcement arriving after it.
 */

export type BannerKind = 'data' | 'version'

type Announcement = {
  kind: BannerKind
  message: string
  actionLabel: string
  onAction: () => void
}

type Listener = () => void

let current: Announcement | null = null
const listeners = new Set<Listener>()
const seen = new Map<string, string>()
let lastMutationAt = 0
let hideTimer: ReturnType<typeof setTimeout> | null = null

const HIDE_AFTER_MS = 12_000
/** A save's own refetch lands within this window; do not mistake it for news. */
const SELF_WRITE_GRACE_MS = 4_000

function emit() {
  listeners.forEach((l) => l())
}

/** autoHideMs of 0 means: stays until the viewer acts on it or dismisses it. */
function announce(next: Announcement, autoHideMs: number) {
  // A pending deploy notice outranks a data blip — it must not be bumped off
  // screen by something less important arriving after it.
  if (current?.kind === 'version' && next.kind === 'data') return

  current = next
  emit()
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = autoHideMs > 0 ? setTimeout(dismissLiveUpdateBanner, autoHideMs) : null
}

export function dismissLiveUpdateBanner() {
  current = null
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = null
  emit()
}

export function useLiveUpdateBanner() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}

/** Used by versionCheck.ts — a distinct message, and it does not time out. */
export function announceNewVersion(onReload: () => void) {
  announce(
    { kind: 'version', message: 'עדכון חדש למערכת', actionLabel: 'לחץ כאן לרענון', onAction: onReload },
    0,
  )
}

/**
 * Watches every query tagged `meta.live` for a background fetch that
 * changed what it holds, and shows the banner when one does. Call once,
 * near the root, alongside the QueryClient that owns those queries.
 */
export function watchForLiveUpdates(queryClient: QueryClient) {
  const mutationUnsubscribe = queryClient.getMutationCache().subscribe((event) => {
    if (event.type === 'updated' && event.mutation.state.status === 'success') {
      lastMutationAt = Date.now()
    }
  })

  const queryUnsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return
    const query = event.query
    if (!query.meta?.live) return

    const key = query.queryHash
    const next = JSON.stringify(query.state.data)
    const previous = seen.get(key)
    seen.set(key, next)

    // The first successful fetch of a query is the initial load, not a
    // change worth announcing — there is nothing yet to compare it against.
    if (previous === undefined) return
    if (previous === next) return
    if (Date.now() - lastMutationAt < SELF_WRITE_GRACE_MS) return

    announce(
      {
        kind: 'data',
        message: 'יש עדכון חדש',
        actionLabel: 'לחץ כאן לריענון',
        onAction: () => {
          queryClient.invalidateQueries()
          dismissLiveUpdateBanner()
        },
      },
      HIDE_AFTER_MS,
    )
  })

  return () => {
    mutationUnsubscribe()
    queryUnsubscribe()
  }
}

import { useSyncExternalStore } from 'react'
import type { QueryClient } from '@tanstack/react-query'

/**
 * The small "there's a new update" tab at the bottom of the screen.
 *
 * A live-polled query (marked with `meta.live`, see livePolling.ts) already
 * refetches and re-renders on its own — this does not gate that. It exists
 * for the moment someone is looking at a screen and something changed
 * somewhere else in the office: a quiet visual swap under someone's cursor
 * is easy to miss entirely, so a small announcement says so out loud, and
 * "לריענון" gives them an immediate, full refresh rather than waiting out
 * the rest of the poll interval.
 *
 * A save the viewer just made themselves is not "someone else changed
 * something" — mutations are tracked separately so the banner stays quiet
 * for a few seconds after one, instead of announcing a person's own edit
 * back to them.
 */

type Listener = () => void

let visible = false
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

function show() {
  visible = true
  emit()
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    visible = false
    emit()
  }, HIDE_AFTER_MS)
}

export function dismissLiveUpdateBanner() {
  visible = false
  if (hideTimer) clearTimeout(hideTimer)
  emit()
}

export function useLiveUpdateBannerVisible() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => visible,
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

    show()
  })

  return () => {
    mutationUnsubscribe()
    queryUnsubscribe()
  }
}

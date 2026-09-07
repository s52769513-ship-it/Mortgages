import { announceNewVersion } from './liveUpdateBanner'

/**
 * Notices when the code running in this tab is no longer what is deployed.
 *
 * A build writes its own identity into the bundle it ships (see
 * vite.config.ts) and drops the same value into version.json alongside it.
 * A tab that has been open since before the last deploy is still running
 * the old bundle, but a fresh fetch of version.json — always uncached, so a
 * stale copy from the browser's own cache can't hide a real deploy — reads
 * whatever is live right now. The two disagreeing is the whole signal: no
 * server push needed, no websocket, just a small file worth checking now
 * and then.
 */

const CHECK_INTERVAL_MS = 3 * 60_000

async function checkOnce() {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return
    const data: unknown = await res.json()
    const live = (data as { version?: unknown })?.version
    if (typeof live === 'string' && live !== __BUILD_VERSION__) {
      announceNewVersion(() => window.location.reload())
    }
  } catch {
    // Offline, or the request was blocked — nothing to say; the next check
    // or the next visibility change tries again.
  }
}

/** Call once, near the root. Checks now, on an interval, and on refocus. */
export function watchForNewVersion() {
  void checkOnce()
  const interval = setInterval(checkOnce, CHECK_INTERVAL_MS)

  // A laptop closed over a deploy and reopened later should not wait out the
  // rest of the interval to find out.
  const onVisible = () => {
    if (document.visibilityState === 'visible') void checkOnce()
  }
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    clearInterval(interval)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

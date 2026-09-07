import { RefreshCw, X } from 'lucide-react'
import { dismissLiveUpdateBanner, useLiveUpdateBanner } from '@/lib/liveUpdateBanner'

/**
 * The small tab itself — bottom of the screen, out of the way of everything
 * else, gone the moment it has been dealt with one way or another. What it
 * says and what its button does come from whichever announcement is active;
 * see liveUpdateBanner.ts.
 */
export function LiveUpdateBanner() {
  const banner = useLiveUpdateBanner()

  if (!banner) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div
        role="status"
        className={[
          'pointer-events-auto flex items-center gap-3 rounded-full bg-ink px-2 py-2 ps-4',
          'text-[13.5px] text-white shadow-modal animate-overlay-in',
        ].join(' ')}
      >
        <span>{banner.message}</span>
        <button
          type="button"
          onClick={banner.onAction}
          className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-medium transition-colors duration-micro ease-standard hover:bg-white/25"
        >
          <RefreshCw className="size-3.5" />
          {banner.actionLabel}
        </button>
        <button
          type="button"
          aria-label="סגור"
          onClick={dismissLiveUpdateBanner}
          className="rounded-full p-1 text-white/70 transition-colors duration-micro hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

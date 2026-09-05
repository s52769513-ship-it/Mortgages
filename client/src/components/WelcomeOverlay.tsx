import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/Logo'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 6) return 'לילה טוב'
  if (hour < 12) return 'בוקר טוב'
  if (hour < 18) return 'צהריים טובים'
  return 'ערב טוב'
}

/**
 * Shown once, right after signing in — not on every page load.
 *
 * A small card rather than a full screen: the dashboard is already loading
 * behind it, and covering the whole system to say hello puts a wall between
 * the agent and the work they came to do.
 */
export function WelcomeOverlay({ name, onDone }: { name: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), 1800)
    const done = setTimeout(onDone, 2200)
    return () => {
      clearTimeout(fade)
      clearTimeout(done)
    }
  }, [onDone])

  return (
    <div
      role="status"
      onClick={onDone}
      className={cn(
        'fixed inset-0 z-[70] flex cursor-pointer items-center justify-center px-4',
        // A wash rather than a blackout: the system stays visible behind it.
        'bg-steel-900/25 backdrop-blur-[2px]',
        'transition-opacity duration-overlay ease-standard',
        leaving ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div
        className={cn(
          'w-full max-w-xs rounded-xl border border-row bg-surface px-7 py-6 text-center shadow-modal',
          'transition-all duration-slow ease-standard',
          leaving ? 'translate-y-1 scale-[0.98]' : 'translate-y-0 scale-100',
        )}
      >
        <Logo variant="mark" height={40} className="mx-auto mb-4" />
        <p className="text-[13.5px] text-ink-muted">{greeting()}</p>
        <p className="mt-0.5 font-heading text-[21px] font-bold leading-tight text-ink">{name}</p>
        <span className="mx-auto mt-3.5 block h-[3px] w-10 rounded-full bg-gold" />
      </div>
    </div>
  )
}

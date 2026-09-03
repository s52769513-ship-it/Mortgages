import { useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { cn } from '@/lib/cn'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 6) return 'לילה טוב'
  if (hour < 12) return 'בוקר טוב'
  if (hour < 18) return 'צהריים טובים'
  return 'ערב טוב'
}

/** Shown once, right after signing in — not on every page load. */
export function WelcomeOverlay({ name, onDone }: { name: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), 1900)
    const done = setTimeout(onDone, 2300)
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
        'fixed inset-0 z-[70] flex cursor-pointer flex-col items-center justify-center bg-steel-900',
        'transition-opacity duration-overlay ease-standard',
        leaving ? 'opacity-0' : 'opacity-100',
      )}
    >
      <span
        className={cn(
          'mb-6 flex size-16 items-center justify-center rounded-xl bg-steel-600 text-white shadow-modal',
          'transition-transform duration-slow ease-standard',
          leaving ? 'scale-95' : 'scale-100',
        )}
      >
        <FolderOpen className="size-8" />
      </span>

      <p className="text-[15px] text-steel-300">{greeting()}</p>
      <h1 className="mt-1.5 font-heading text-[34px] font-bold text-white">{name}</h1>
      <p className="mt-4 text-[14px] text-steel-400">ניהול משכנתאות</p>
    </div>
  )
}

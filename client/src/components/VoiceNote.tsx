import { useEffect, useState } from 'react'
import { Download, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Plays a voice note.
 *
 * The file is fetched and handed to the player as a blob rather than pointed
 * at with a src, for the same reason the logo is drawn instead of loaded: the
 * office network runs a filter that inspects what the browser asks for, and a
 * request the browser labels as media is treated differently from an ordinary
 * one. Fetching it plainly gets the bytes; the player never makes a media
 * request of its own.
 *
 * When the browser cannot decode what it got — Safari has never played the
 * WebM that Chrome records — the note offers itself for download rather than
 * sitting there as a dead player.
 */
export function VoiceNote({
  url,
  durationLabel,
  mine,
}: {
  url: string
  durationLabel?: string
  mine: boolean
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    fetch(url, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.blob()
      })
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => !cancelled && setFailed(true))

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  if (failed) {
    return (
      <a
        href={url}
        download
        className={cn(
          'mt-2 flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px]',
          'transition-colors duration-micro ease-standard',
          mine ? 'bg-white/15 hover:bg-white/25' : 'bg-surface-raised hover:bg-ink/[0.06]',
        )}
      >
        <TriangleAlert className="size-4 shrink-0" />
        <span className="flex-1">לא ניתן לנגן כאן</span>
        <Download className="size-4 shrink-0" />
      </a>
    )
  }

  return (
    <div className="mt-2 space-y-1">
      <audio
        controls
        src={src ?? undefined}
        onError={() => setFailed(true)}
        className="h-9 w-full max-w-[240px]"
      />
      {durationLabel && (
        <span className={cn('numeric text-[11.5px]', mine ? 'text-white/70' : 'text-ink-subtle')}>
          {durationLabel}
        </span>
      )}
    </div>
  )
}

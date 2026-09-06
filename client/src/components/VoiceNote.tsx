import { useEffect, useState } from 'react'
import { Download, Loader2, TriangleAlert } from 'lucide-react'
import { tokenStore } from '@/api/client'
import { cn } from '@/lib/cn'

/**
 * Plays a voice note.
 *
 * The office network runs a content filter, and a browser labels a request for
 * media differently from an ordinary one — so a filter can block one route and
 * allow the other. Rather than betting on which, this tries both: first it
 * fetches the bytes plainly and plays them from memory; if that is refused it
 * points the player straight at the URL, which is a media request. Only when
 * both fail does it stop and offer the file for download.
 *
 * The player is not rendered until there is something for it to play — an
 * empty audio element reports an error of its own in some browsers, which
 * would look exactly like a failure that had not happened.
 */

type Source = { url: string; kind: 'blob' | 'direct' }

export function VoiceNote({
  url,
  durationLabel,
  mine,
}: {
  url: string
  durationLabel?: string
  mine: boolean
}) {
  const [source, setSource] = useState<Source | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    const token = tokenStore.get()
    fetch(url, {
      credentials: 'same-origin',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.blob()
      })
      .then((blob) => {
        if (cancelled) return
        if (!blob.size) throw new Error('empty')
        objectUrl = URL.createObjectURL(blob)
        setSource({ url: objectUrl, kind: 'blob' })
      })
      .catch(() => {
        // Fetching was refused. Let the player ask for it as media instead.
        if (!cancelled) setSource({ url, kind: 'direct' })
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  const onAudioError = () => {
    // The blob route produced something the player would not take; the direct
    // route is still worth a try. If that fails too, there is nothing left.
    if (source?.kind === 'blob') setSource({ url, kind: 'direct' })
    else setFailed(true)
  }

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
        <span className="flex-1">לא ניתן לנגן כאן — הורד להאזנה</span>
        <Download className="size-4 shrink-0" />
      </a>
    )
  }

  if (!source) {
    return (
      <div
        className={cn(
          'mt-2 flex h-9 max-w-[240px] items-center gap-2 rounded-md px-2.5 text-[13px]',
          mine ? 'bg-white/15 text-white/70' : 'bg-surface-raised text-ink-subtle',
        )}
      >
        <Loader2 className="size-3.5 animate-spin" />
        טוען הקלטה…
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-1">
      <audio
        key={source.url}
        controls
        preload="metadata"
        src={source.url}
        onError={onAudioError}
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

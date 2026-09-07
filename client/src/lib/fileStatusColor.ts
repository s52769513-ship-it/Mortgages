import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { FILE_STATUS, type Tone } from '@/lib/labels'

/** Every status resolves to one of these five before it is ever compared. */
export const TONE_SWATCHES: { value: Tone; label: string }[] = [
  { value: 'neutral', label: 'אפור' },
  { value: 'busy', label: 'כחול' },
  { value: 'ok', label: 'ירוק' },
  { value: 'wait', label: 'כתום' },
  { value: 'urgent', label: 'אדום' },
]

const BUILT_IN: Record<string, Tone> = Object.fromEntries(
  Object.entries(FILE_STATUS).map(([key, e]) => [key, e.tone]),
)

/**
 * A file status's colour, as the office set it in Settings — falling back to
 * the built-in default the moment a status has not been customised, so an
 * office that never opens that screen sees exactly what it always has.
 *
 * Reads the same ['settings'] cache every settings-backed picker already
 * shares, so this costs nothing extra wherever one of those is already on
 * the page.
 */
export function useFileStatusTone() {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Record<string, unknown>>('/settings'),
    staleTime: 5 * 60_000,
  })
  const custom = (data?.fileStatusColors ?? {}) as Partial<Record<string, Tone>>
  return (status: string): Tone => custom[status] ?? BUILT_IN[status] ?? 'neutral'
}

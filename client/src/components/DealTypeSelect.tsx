import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Select } from '@/components/ui/Field'

/**
 * Picks a deal type from the office's own list, instead of typing the same
 * handful of words on every file. The list is configured in Settings, since
 * offices do not all call the same thing by the same word.
 *
 * A file whose deal type predates the list, or was typed before this existed,
 * still shows correctly: its own value is added to the options so it stays
 * visible and selected rather than reading as blank — an edit that never
 * touches this field must never quietly rewrite what was already there.
 */

const FALLBACK = ['רכישת דירה', 'מחזור משכנתא', 'משכנתא לכל מטרה', 'בנייה עצמית', 'גישור']

export function DealTypeSelect({
  value,
  onChange,
  hint,
}: {
  value: string
  onChange: (value: string) => void
  hint?: string
}) {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Record<string, unknown>>('/settings'),
    staleTime: 5 * 60_000,
  })
  const presets = Array.isArray(data?.dealTypes) ? (data!.dealTypes as string[]) : FALLBACK
  const options = value && !presets.includes(value) ? [value, ...presets] : presets

  return (
    <Select
      label="סוג העסקה"
      placeholder="בחר סוג עסקה…"
      options={options.map((o) => ({ value: o, label: o }))}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      hint={hint}
    />
  )
}

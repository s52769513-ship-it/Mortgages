const currency = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
})

const compact = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 })

export const money = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '—' : currency.format(Number(value))

export const number = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '—' : compact.format(Number(value))

export const percent = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '—' : `${Number(value).toFixed(1)}%`

export const date = (value: string | Date | null | undefined) =>
  !value ? '—' : new Date(value).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })

export const time = (value: string | Date | null | undefined) =>
  !value
    ? '—'
    : new Date(value).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })

export const dateTime = (value: string | Date | null | undefined) =>
  !value
    ? '—'
    : new Date(value).toLocaleString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })

/** "לפני 3 שעות" / "מחר" — for feeds and due dates. */
export function relative(value: string | Date | null | undefined) {
  if (!value) return '—'
  const target = new Date(value).getTime()
  const diffMs = target - Date.now()
  const rtf = new Intl.RelativeTimeFormat('he-IL', { numeric: 'auto' })

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ]
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit)
  }
  return 'עכשיו'
}

export const isOverdue = (value: string | null | undefined) =>
  Boolean(value) && new Date(value!).getTime() < Date.now()

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')

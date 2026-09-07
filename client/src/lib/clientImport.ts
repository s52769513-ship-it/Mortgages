import { AVAILABILITY, CLIENT_PRIORITY, CONTACT_METHOD, LEAD_STATUS } from '@/lib/labels'
import type { CellValue } from '@/lib/sheet'

/**
 * What a spreadsheet column can be turned into, and how.
 *
 * The conversions here are the ones a person would do by hand and resent
 * doing four hundred times: a date written the way it is written in Israel,
 * a phone number Excel helpfully stripped the leading zero from, a status
 * written in Hebrew that has to become the value the API knows.
 */

export type TargetKind = 'text' | 'phone' | 'email' | 'number' | 'date' | 'boolean' | 'enum' | 'enumList'

export type Target = {
  key: string
  label: string
  kind: TargetKind
  /** For an enum, the dictionary its values come from. */
  dict?: Record<string, { label: string }>
  required?: boolean
  /** Header wordings seen in the wild, used to guess the mapping. */
  aliases: string[]
}

export const CLIENT_TARGETS: Target[] = [
  { key: 'fullName', label: 'שם מלא', kind: 'text', required: true, aliases: ['שם', 'שם הלקוח', 'שם לקוח', 'לקוח', 'name', 'full name', 'client'] },
  { key: 'phone', label: 'טלפון', kind: 'phone', aliases: ['נייד', 'טלפון נייד', 'מספר טלפון', 'phone', 'mobile', 'tel'] },
  { key: 'email', label: 'אימייל', kind: 'email', aliases: ['מייל', 'דואר אלקטרוני', 'email', 'mail', 'e-mail'] },
  { key: 'partnerName', label: 'שם בן/בת הזוג', kind: 'text', aliases: ['בן זוג', 'בת זוג', 'שם 2', 'לווה נוסף', 'partner'] },
  { key: 'partnerPhone', label: 'טלפון בן/בת הזוג', kind: 'phone', aliases: ['טלפון 2', 'נייד 2', 'טלפון בן זוג'] },
  { key: 'leadStatus', label: 'סטטוס ליד', kind: 'enum', dict: LEAD_STATUS, aliases: ['סטטוס', 'מצב ליד', 'status'] },
  { key: 'referralSource', label: 'מקור ההפניה', kind: 'text', aliases: ['מקור', 'הגיע מ', 'ממליץ', 'source', 'referral'] },
  { key: 'referralDate', label: 'תאריך ההפניה', kind: 'date', aliases: ['תאריך פנייה', 'תאריך הפנייה', 'תאריך', 'date'] },
  { key: 'inquiryType', label: 'סוג הפנייה', kind: 'text', aliases: ['סוג פנייה', 'סוג בקשה'] },
  { key: 'inquiryStatus', label: 'סטטוס הפנייה', kind: 'text', aliases: ['מצב פנייה'] },
  { key: 'preferredContact', label: 'דרך תקשורת מועדפת', kind: 'enum', dict: CONTACT_METHOD, aliases: ['דרך התקשרות', 'תקשורת מועדפת'] },
  { key: 'doNotContact', label: 'אין לשלוח הודעות', kind: 'boolean', aliases: ['לא לשלוח', 'חסום', 'do not contact'] },
  { key: 'introNotes', label: 'הערות מהיכרות', kind: 'text', aliases: ['הערות', 'notes', 'הערה'] },
  { key: 'declaredIncome', label: 'הכנסה מוצהרת', kind: 'number', aliases: ['הכנסה', 'הכנסות', 'שכר', 'income'] },
  { key: 'declaredAssets', label: 'נכסים מוצהרים', kind: 'text', aliases: ['נכסים', 'assets'] },
  { key: 'declaredLiabilities', label: 'התחייבויות מוצהרות', kind: 'text', aliases: ['התחייבויות', 'הלוואות', 'liabilities'] },
  { key: 'targetDate', label: 'תאריך ביצוע מבוקש', kind: 'date', aliases: ['תאריך ביצוע', 'מועד ביצוע', 'יעד'] },
  { key: 'agreedFee', label: 'שכר טרחה שסוכם', kind: 'number', aliases: ['שכר טרחה', 'שכ"ט', 'עמלה', 'fee'] },
  { key: 'priorities', label: 'מה חשוב ללקוח', kind: 'enumList', dict: CLIENT_PRIORITY, aliases: ['חשוב ללקוח', 'העדפות', 'priorities'] },
  { key: 'prioritiesNote', label: 'פירוט מה חשוב ללקוח', kind: 'text', aliases: ['פירוט העדפות'] },
  { key: 'availPhone', label: 'זמינות לשיחות', kind: 'enum', dict: AVAILABILITY, aliases: ['זמינות טלפון', 'זמינות לשיחה'] },
  { key: 'availWhatsapp', label: 'זמינות בוואטסאפ', kind: 'enum', dict: AVAILABILITY, aliases: ['זמינות וואטסאפ', 'whatsapp'] },
  { key: 'availEmail', label: 'זמינות במייל', kind: 'enum', dict: AVAILABILITY, aliases: ['זמינות מייל'] },
]

/** Everything a mapped column can point at. */
export type Mapping =
  | { kind: 'ignore' }
  | { kind: 'target'; key: string }
  | { kind: 'custom'; fieldId: string }
  /** A field that does not exist yet; created just before the import runs. */
  | { kind: 'new'; label: string; type: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' }

const normalise = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/["'׳״.]/g, '')
    .replace(/\s+/g, ' ')

/**
 * Guesses which field a column belongs to from its header. An exact match on
 * the field's own name wins; otherwise the aliases are tried. A guess is only
 * ever a starting point — the screen shows it and lets it be overruled.
 */
export function guessTarget(header: string, taken: Set<string>): string | null {
  const h = normalise(header)
  if (!h) return null

  for (const target of CLIENT_TARGETS) {
    if (taken.has(target.key)) continue
    if (normalise(target.label) === h) return target.key
  }
  for (const target of CLIENT_TARGETS) {
    if (taken.has(target.key)) continue
    if (target.aliases.some((alias) => normalise(alias) === h)) return target.key
  }
  // A looser pass, so "טלפון נייד של הלקוח" still finds the phone column.
  for (const target of CLIENT_TARGETS) {
    if (taken.has(target.key)) continue
    if ([target.label, ...target.aliases].some((a) => h.includes(normalise(a)))) return target.key
  }
  return null
}

/**
 * Dates are written day-first here, which is exactly the order the browser's
 * own parser reads backwards. So the common written forms are taken apart by
 * hand, and only what is left over is handed to the parser.
 */
function toDate(value: CellValue): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value === 'number') {
    // An Excel serial: days since 1899-12-30, which is the epoch Excel counts
    // from once its leap-year bug is accounted for.
    const ms = Math.round((value - 25569) * 86400 * 1000)
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const text = String(value ?? '').trim()
  if (!text) return null

  const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    const year = y.length === 2 ? 2000 + Number(y) : Number(y)
    const date = new Date(Date.UTC(year, Number(m) - 1, Number(d)))
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/**
 * Excel reads 0521234567 as a number and drops the leading zero. A nine-digit
 * number where a phone was expected is that, and is given its zero back.
 */
function toPhone(value: CellValue): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim().replace(/\s+/g, ' ')
  if (!text) return null

  const digits = text.replace(/\D/g, '')
  if (!digits) return null

  // One cell holding two numbers is common in an old list. Squeezing the
  // punctuation out of it would weld them into a single impossible number,
  // so anything too long to be one phone is kept as it was written.
  if (digits.length > 15) return text

  if (typeof value === 'number' || /^\d+$/.test(text)) {
    // Excel reads 0521234567 as a number and drops the leading zero.
    return digits.length === 9 ? `0${digits}` : digits
  }
  return text.replace(/[\s\-()]/g, '') || null
}

function toNumber(value: CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value ?? '').replace(/[^\d.,-]/g, '').replace(/,/g, '')
  if (!text) return null
  const num = Number(text)
  return Number.isFinite(num) ? num : null
}

function toBoolean(value: CellValue): boolean | null {
  if (typeof value === 'boolean') return value
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return null
  if (/^(כן|yes|true|1|v|✓|x)$/.test(text)) return true
  if (/^(לא|no|false|0|-)$/.test(text)) return false
  return null
}

/** Matches a written value back to its enum key, by key or by Hebrew label. */
function toEnum(value: CellValue, dict: Record<string, { label: string }>): string | null {
  const text = normalise(String(value ?? ''))
  if (!text) return null
  for (const [key, entry] of Object.entries(dict)) {
    if (normalise(key) === text || normalise(entry.label) === text) return key
  }
  // Half a label is still a recognisable answer: "ריביות" for "ריביות ותנאים".
  for (const [key, entry] of Object.entries(dict)) {
    if (normalise(entry.label).includes(text) || text.includes(normalise(entry.label))) return key
  }
  return null
}

/** Converts one cell for one target. Returns undefined when there is nothing. */
export function convert(value: CellValue, target: Target): unknown {
  if (value === null || value === undefined || String(value).trim() === '') return undefined

  switch (target.kind) {
    case 'phone':
      return toPhone(value) ?? undefined
    case 'number':
      return toNumber(value) ?? undefined
    case 'date':
      return toDate(value) ?? undefined
    case 'boolean':
      return toBoolean(value) ?? undefined
    case 'email': {
      const text = String(value).trim()
      return /.+@.+\..+/.test(text) ? text : undefined
    }
    case 'enum':
      return target.dict ? (toEnum(value, target.dict) ?? undefined) : undefined
    case 'enumList': {
      if (!target.dict) return undefined
      const parts = String(value)
        .split(/[,،;|/]/)
        .map((p) => toEnum(p, target.dict!))
        .filter((p): p is string => Boolean(p))
      return parts.length ? Array.from(new Set(parts)) : undefined
    }
    default:
      return String(value).trim()
  }
}

/** The same conversion for a field the office invented, by its declared type. */
export function convertCustom(value: CellValue, type: string): unknown {
  if (value === null || value === undefined || String(value).trim() === '') return undefined
  if (type === 'NUMBER') return toNumber(value) ?? undefined
  if (type === 'DATE') return toDate(value) ?? undefined
  if (type === 'BOOLEAN') return toBoolean(value) ?? undefined
  return String(value).trim()
}

export const targetOf = (key: string) => CLIENT_TARGETS.find((t) => t.key === key)

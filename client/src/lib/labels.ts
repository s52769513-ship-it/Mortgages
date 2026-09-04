/**
 * Hebrew labels for every enum the API returns, plus the display tone.
 *
 * The spec allows four state colours only. The data model keeps its full
 * granularity — ten task statuses, nine document statuses — and each one is
 * mapped here onto one of those four (or neutral, which renders as an
 * outline chip rather than a fill).
 */

export type Tone = 'neutral' | 'busy' | 'ok' | 'wait' | 'urgent'

export type Entry = { label: string; tone: Tone }
type Dict = Record<string, Entry>

export const LEAD_STATUS = {
  NEW: { label: 'ליד חדש', tone: 'neutral' },
  CONTACTED: { label: 'נוצר קשר', tone: 'busy' },
  QUALIFIED: { label: 'מתאים', tone: 'busy' },
  CONVERTED: { label: 'נסגר בהצלחה', tone: 'ok' },
  ON_HOLD: { label: 'בהמתנה', tone: 'wait' },
  LOST: { label: 'אבד', tone: 'urgent' },
} satisfies Dict

/** The six stepper steps, in pipeline order. */
export const STAGE_ORDER = [
  'INTAKE',
  'DOCUMENT_COLLECTION',
  'BANK_SUBMISSION',
  'APPROVAL_IN_PRINCIPLE',
  'COLLATERAL',
  'EXECUTION',
] as const

export type Stage = (typeof STAGE_ORDER)[number]

export const FILE_STAGE = {
  INTAKE: { label: 'היכרות', tone: 'busy' },
  DOCUMENT_COLLECTION: { label: 'איסוף מסמכים', tone: 'busy' },
  BANK_SUBMISSION: { label: 'בקשה לבנק', tone: 'busy' },
  APPROVAL_IN_PRINCIPLE: { label: 'אישור עקרוני', tone: 'busy' },
  COLLATERAL: { label: 'בטחונות', tone: 'busy' },
  EXECUTION: { label: 'ביצוע ותשלום', tone: 'ok' },
} satisfies Record<Stage, Entry>

export const FILE_STATUS = {
  ACTIVE: { label: 'בטיפול', tone: 'busy' },
  BLOCKED: { label: 'חסום', tone: 'urgent' },
  ON_HOLD: { label: 'בהמתנה', tone: 'wait' },
  COMPLETED: { label: 'הושלם', tone: 'ok' },
  CANCELLED: { label: 'בוטל', tone: 'neutral' },
} satisfies Dict

export const URGENCY = {
  LOW: { label: 'נמוכה', tone: 'neutral' },
  NORMAL: { label: 'רגילה', tone: 'busy' },
  HIGH: { label: 'גבוהה', tone: 'wait' },
  CRITICAL: { label: 'קריטית', tone: 'urgent' },
} satisfies Dict

/** Ten stored statuses, four display colours. */
export const TASK_STATUS = {
  OPEN: { label: 'פתוחה', tone: 'busy' },
  IN_PROGRESS: { label: 'בטיפול', tone: 'busy' },
  WAITING_CLIENT: { label: 'ממתין ללקוח', tone: 'wait' },
  WAITING_BANK: { label: 'ממתין לבנק', tone: 'wait' },
  WAITING_APPRAISER: { label: 'ממתין לשמאי', tone: 'wait' },
  WAITING_LAWYER: { label: 'ממתין לעו״ד', tone: 'wait' },
  WAITING_OTHER: { label: 'ממתין לגורם אחר', tone: 'wait' },
  COMPLETED: { label: 'הושלמה', tone: 'ok' },
  CANCELLED: { label: 'בוטלה', tone: 'neutral' },
  NOT_RELEVANT: { label: 'לא רלוונטית', tone: 'neutral' },
} satisfies Dict

/** Statuses that still need someone to act. */
export const OPEN_TASK_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'WAITING_BANK',
  'WAITING_APPRAISER',
  'WAITING_LAWYER',
  'WAITING_OTHER',
] as const

/** True for the statuses that require naming who we are waiting on. */
export const isWaitingStatus = (status: string) => status.startsWith('WAITING_')

export const TASK_PRIORITY = {
  NORMAL: { label: 'רגילה', tone: 'neutral' },
  HIGH: { label: 'גבוהה', tone: 'wait' },
  URGENT: { label: 'דחופה', tone: 'urgent' },
} satisfies Dict

export const DOCUMENT_STATUS = {
  REQUIRED: { label: 'נדרש', tone: 'neutral' },
  REQUESTED: { label: 'התבקש', tone: 'wait' },
  RECEIVED: { label: 'התקבל', tone: 'busy' },
  UNDER_REVIEW: { label: 'בבדיקה', tone: 'busy' },
  INVALID: { label: 'לא תקין', tone: 'urgent' },
  MISSING: { label: 'חסר', tone: 'urgent' },
  APPROVED: { label: 'אושר', tone: 'ok' },
  EXPIRED: { label: 'פג תוקף', tone: 'urgent' },
  NOT_RELEVANT: { label: 'לא רלוונטי', tone: 'neutral' },
} satisfies Dict

export const BANK_APP_STATUS = {
  DRAFT: { label: 'טיוטה', tone: 'neutral' },
  SUBMITTED: { label: 'הוגשה', tone: 'busy' },
  UNDER_REVIEW: { label: 'בבדיקה', tone: 'busy' },
  MISSING_DOCS: { label: 'חסרים מסמכים', tone: 'wait' },
  APPROVED_IN_PRINCIPLE: { label: 'אושר עקרונית', tone: 'ok' },
  APPROVED: { label: 'אושר', tone: 'ok' },
  REJECTED: { label: 'נדחה', tone: 'urgent' },
  EXECUTED: { label: 'בוצע', tone: 'ok' },
} satisfies Dict

export const CONTACT_METHOD = {
  PHONE: { label: 'טלפון', tone: 'neutral' },
  EMAIL: { label: 'אימייל', tone: 'neutral' },
  MEETING: { label: 'פגישה', tone: 'neutral' },
} satisfies Dict

export const COMMUNICATION_TYPE = {
  EMAIL: { label: 'מייל', tone: 'neutral' },
  PHONE: { label: 'טלפון', tone: 'neutral' },
  MEETING: { label: 'פגישה', tone: 'neutral' },
  LETTER: { label: 'מכתב', tone: 'neutral' },
} satisfies Dict

export const PROFESSIONAL_ROLE = {
  BANK_MANAGER: { label: 'מנהל בנק', tone: 'neutral' },
  BANKER: { label: 'בנקאי', tone: 'neutral' },
  APPRAISER: { label: 'שמאי', tone: 'neutral' },
  CLIENT_LAWYER: { label: 'עו״ד הלקוח', tone: 'neutral' },
  SELLER_LAWYER: { label: 'עו״ד המוכר', tone: 'neutral' },
  DEVELOPER_LAWYER: { label: 'עו״ד הקבלן', tone: 'neutral' },
  SELLER: { label: 'מוכר', tone: 'neutral' },
  DEVELOPER: { label: 'יזם', tone: 'neutral' },
  INSURANCE_AGENT: { label: 'סוכן ביטוח', tone: 'neutral' },
  COURIER: { label: 'שליח', tone: 'neutral' },
  ACCOUNTANT: { label: 'רואה חשבון', tone: 'neutral' },
  OTHER_LENDER: { label: 'גורם מלווה נוסף', tone: 'neutral' },
} satisfies Dict

export const ROLE = {
  ADMIN: { label: 'מנהל מערכת', tone: 'neutral' },
  MANAGER: { label: 'מנהל צוות', tone: 'neutral' },
  AGENT: { label: 'סוכן', tone: 'neutral' },
  VIEWER: { label: 'צפייה בלבד', tone: 'neutral' },
} satisfies Dict

/** Safe lookup — an unknown key falls back to showing the raw value. */
export function labelOf(dict: Dict, key: string | null | undefined): Entry {
  if (!key) return { label: '—', tone: 'neutral' }
  return dict[key] ?? { label: key, tone: 'neutral' }
}

export const options = (dict: Dict) =>
  Object.entries(dict).map(([value, { label }]) => ({ value, label }))

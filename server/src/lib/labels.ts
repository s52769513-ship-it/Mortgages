/**
 * Hebrew names for the stored enum values.
 *
 * The client has its own copy alongside the colour each status is drawn in.
 * This one exists because a generated PDF is written on the server, where
 * "APPROVED_IN_PRINCIPLE" is not something to hand a bank.
 */

type Labels = Record<string, string>

export const FILE_STAGE: Labels = {
  INTAKE: 'היכרות',
  DOCUMENT_COLLECTION: 'איסוף מסמכים',
  BANK_SUBMISSION: 'בקשה לבנק',
  APPROVAL_IN_PRINCIPLE: 'אישור עקרוני',
  COLLATERAL: 'בטחונות',
  EXECUTION: 'ביצוע ותשלום',
}

export const FILE_STATUS: Labels = {
  ACTIVE: 'בטיפול',
  BLOCKED: 'חסום',
  ON_HOLD: 'בהמתנה',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל',
}

export const URGENCY: Labels = {
  LOW: 'נמוכה',
  NORMAL: 'רגילה',
  HIGH: 'גבוהה',
  CRITICAL: 'קריטית',
}

export const DOCUMENT_STATUS: Labels = {
  REQUIRED: 'נדרש',
  REQUESTED: 'התבקש',
  RECEIVED: 'התקבל',
  UNDER_REVIEW: 'בבדיקה',
  INVALID: 'לא תקין',
  MISSING: 'חסר',
  APPROVED: 'אושר',
  EXPIRED: 'פג תוקף',
  NOT_RELEVANT: 'לא רלוונטי',
}

export const BANK_APP_STATUS: Labels = {
  DRAFT: 'טיוטה',
  SUBMITTED: 'הוגשה',
  UNDER_REVIEW: 'בבדיקה',
  MISSING_DOCS: 'חסרים מסמכים',
  APPROVED_IN_PRINCIPLE: 'אושר עקרונית',
  APPROVED: 'אושר',
  REJECTED: 'נדחה',
  EXECUTED: 'בוצע',
}

export const PROFESSIONAL_ROLE: Labels = {
  BANK_MANAGER: 'מנהל בנק',
  BANKER: 'בנקאי',
  APPRAISER: 'שמאי',
  CLIENT_LAWYER: 'עו״ד הלקוח',
  SELLER_LAWYER: 'עו״ד המוכר',
  DEVELOPER_LAWYER: 'עו״ד הקבלן',
  SELLER: 'מוכר',
  DEVELOPER: 'יזם',
  INSURANCE_AGENT: 'סוכן ביטוח',
  COURIER: 'שליח',
  ACCOUNTANT: 'רואה חשבון',
  OTHER_LENDER: 'גורם מלווה נוסף',
}

/** Falls back to the stored value, so a new enum member is never blank. */
export const labelOf = (labels: Labels, value: string) => labels[value] ?? value

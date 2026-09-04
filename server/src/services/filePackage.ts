import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http.js'
import { resolveStored } from '../lib/storage.js'
import { runsOf } from '../lib/rtl.js'
import {
  BANK_APP_STATUS,
  DOCUMENT_STATUS,
  FILE_STAGE,
  FILE_STATUS,
  PROFESSIONAL_ROLE,
  URGENCY,
  labelOf,
} from '../lib/labels.js'

const A4 = { width: 595.28, height: 841.89 }
const MARGIN = 46
const INK = rgb(0.11, 0.13, 0.16)
const MUTED = rgb(0.42, 0.46, 0.51)
const RULE = rgb(0.85, 0.87, 0.89)

const here = path.dirname(fileURLToPath(import.meta.url))
/** Bundled rather than taken from the host: the deploy image has no fonts. */
const FONT_DIR = path.resolve(here, '../../assets')

/** What can be folded into one PDF. Everything else is named, never dropped. */
const MERGEABLE = new Set(['.pdf', '.png', '.jpg', '.jpeg'])

const money = (value: unknown) => {
  if (value === null || value === undefined) return '—'
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toLocaleString('en-US')} ₪` : '—'
}

const percent = (value: unknown) =>
  value === null || value === undefined ? '—' : `${Number(value)}%`

const date = (value: Date | null | undefined) =>
  value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem' }).format(value) : '—'

const text = (value: string | null | undefined) => (value?.trim() ? value.trim() : '—')

/**
 * Lays a right-to-left sheet out from the top, breaking pages as it fills.
 * Lines are drawn one directional run at a time — see the note in rtl.ts.
 */
class Sheet {
  page!: PDFPage
  y = 0
  readonly right = A4.width - MARGIN
  readonly left = MARGIN

  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
  ) {
    this.newPage()
  }

  newPage() {
    this.page = this.doc.addPage([A4.width, A4.height])
    this.y = A4.height - MARGIN
  }

  private room(needed: number) {
    if (this.y - needed < MARGIN + 24) this.newPage()
  }

  /** The width one line will occupy once its runs are laid side by side. */
  private measure(value: string, size: number, font: PDFFont) {
    return runsOf(value).reduce((total, run) => total + font.widthOfTextAtSize(run.text, size), 0)
  }

  /**
   * Draws a line whose right edge sits at `rightEdge`, one call per run so the
   * font shapes each in its own direction. Returns the width used.
   */
  private drawLine(
    value: string,
    rightEdge: number,
    y: number,
    size: number,
    font: PDFFont,
    color = INK,
  ) {
    let cursor = rightEdge
    for (const run of runsOf(value)) {
      const width = font.widthOfTextAtSize(run.text, size)
      this.page.drawText(run.text, { x: cursor - width, y, size, font, color })
      cursor -= width
    }
    return rightEdge - cursor
  }

  /** Trims from the end of the line, which on a right-to-left page is its left. */
  private fit(value: string, size: number, font: PDFFont, max: number) {
    let out = value
    while (out.length > 1 && this.measure(out, size, font) > max) out = out.slice(0, -1)
    return out
  }

  private rightText(value: string, size: number, font: PDFFont, color = INK, offset = 0) {
    this.drawLine(value, this.right - offset, this.y, size, font, color)
  }

  title(value: string, sub?: string) {
    this.room(52)
    this.rightText(value, 20, this.bold)
    this.y -= 18
    if (sub) {
      this.rightText(sub, 10.5, this.font, MUTED)
      this.y -= 14
    }
    this.y -= 8
  }

  heading(value: string) {
    this.room(40)
    this.y -= 10
    this.rightText(value, 12.5, this.bold)
    this.y -= 7
    this.page.drawLine({
      start: { x: this.left, y: this.y },
      end: { x: this.right, y: this.y },
      thickness: 0.7,
      color: RULE,
    })
    this.y -= 15
  }

  /** Two facts to a line, label then value, both reading from the right. */
  facts(pairs: [string, string][]) {
    const columnWidth = (this.right - this.left) / 2

    for (let i = 0; i < pairs.length; i += 2) {
      this.room(20)
      pairs.slice(i, i + 2).forEach(([label, value], column) => {
        const edge = this.right - column * columnWidth
        const labelWidth = this.drawLine(`${label}:`, edge, this.y, 9.5, this.font, MUTED)
        this.drawLine(value, edge - labelWidth - 6, this.y, 10, this.bold, INK)
      })
      this.y -= 17
    }
    this.y -= 4
  }

  /** Columns are given as fractions of the writable width, right to left. */
  table(headers: string[], rows: string[][], widths: number[]) {
    const usable = this.right - this.left
    const columnX = (index: number) =>
      this.right - widths.slice(0, index).reduce((sum, w) => sum + w, 0) * usable

    this.room(30)
    headers.forEach((header, i) => this.drawLine(header, columnX(i), this.y, 8.5, this.font, MUTED))
    this.y -= 12

    for (const row of rows) {
      this.room(18)
      row.forEach((cell, i) => {
        // Keep a cell inside its column rather than letting it run into the next.
        const max = widths[i] * usable - 8
        this.drawLine(this.fit(cell, 9.5, this.font, max), columnX(i), this.y, 9.5, this.font, INK)
      })
      this.y -= 15
    }
    this.y -= 6
  }

  note(value: string) {
    this.room(20)
    this.rightText(value, 9, this.font, MUTED)
    this.y -= 14
  }
}

export type PackageResult = {
  bytes: Uint8Array
  fileName: string
  /** Plain-ASCII stand-in for clients that ignore the encoded name. */
  asciiName: string
  attached: number
  skipped: string[]
}

/**
 * Assembles the whole file into a single PDF: a cover sheet stating what the
 * deal is and who is involved, then the documents themselves, so the folder
 * that reaches the bank is one file rather than a dozen attachments.
 */
export async function buildBankPackage(fileId: string): Promise<PackageResult> {
  const file = await prisma.mortgageFile.findUnique({
    where: { id: fileId },
    include: {
      client: true,
      owner: { select: { name: true } },
      targetBank: true,
      documents: { orderBy: { seq: 'asc' } },
      bankApps: {
        include: { bank: true, branch: true, banker: true },
        orderBy: [{ isChosen: 'desc' }, { seq: 'asc' }],
      },
      professionals: { include: { professional: true } },
    },
  })
  if (!file) throw new HttpError(404, 'התיק לא נמצא')

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)

  let font: PDFFont
  let bold: PDFFont
  try {
    font = await pdf.embedFont(await readFile(path.join(FONT_DIR, 'DejaVuSans.ttf')), {
      subset: true,
    })
    bold = await pdf.embedFont(await readFile(path.join(FONT_DIR, 'DejaVuSans-Bold.ttf')), {
      subset: true,
    })
  } catch {
    // Without the Hebrew font the cover would be unreadable, which is worse
    // than saying plainly that the package cannot be built.
    throw new HttpError(500, 'גופן החבילה חסר בשרת — לא ניתן להפיק את הקובץ')
  }

  const sheet = new Sheet(pdf, font, bold)

  sheet.title(
    `תיק משכנתא ${file.fileNumber}`,
    `${file.client.fullName} · הופק ${date(new Date())}${file.owner ? ` · ${file.owner.name}` : ''}`,
  )

  sheet.heading('הלקוח')
  sheet.facts([
    ['שם', text(file.client.fullName)],
    ['טלפון', text(file.client.phone)],
    ['אימייל', text(file.client.email)],
    ['אחראי מוביל', text(file.owner?.name)],
  ])

  sheet.heading('העסקה')
  sheet.facts([
    ['סוג עסקה', text(file.dealType)],
    ['סוג נכס', text(file.propertyType)],
    ['כתובת הנכס', text(file.propertyAddress)],
    ['מחיר רכישה', money(file.purchasePrice)],
    ['שווי הנכס', money(file.propertyValue)],
    ['שלב', labelOf(FILE_STAGE, file.stage)],
    ['מצב התיק', labelOf(FILE_STATUS, file.status)],
    ['דחיפות', labelOf(URGENCY, file.urgency)],
  ])

  sheet.heading('המימון')
  sheet.facts([
    ['סכום מבוקש', money(file.requestedAmount)],
    ['אחוז מימון', percent(file.ltvPercent)],
    ['הון עצמי', money(file.equity)],
    ['החזר חודשי רצוי', money(file.desiredMonthly)],
    ['הכנסה נדרשת', money(file.requiredIncome)],
    ['הכנסות הלווים', money(file.borrowersIncome)],
    ['תאריך תשלום קרוב', date(file.nextPaymentDate)],
    ['מועד אחרון לביצוע', date(file.executionDeadline)],
  ])
  if (file.existingLiabilities?.trim()) {
    sheet.note(`התחייבויות קיימות: ${file.existingLiabilities.trim()}`)
  }

  if (file.bankApps.length) {
    sheet.heading('בקשות לבנקים')
    sheet.table(
      ['בנק', 'סניף', 'סטטוס', 'סכום', 'מימון', 'תוקף אישור'],
      file.bankApps.map((app) => [
        `${app.isChosen ? '★ ' : ''}${app.bank.name}`,
        text(app.branch?.name),
        labelOf(BANK_APP_STATUS, app.status),
        money(app.requestedAmount),
        percent(app.ltvPercent),
        date(app.approvalValidUntil),
      ]),
      [0.2, 0.17, 0.18, 0.18, 0.11, 0.16],
    )
  }

  if (file.professionals.length) {
    sheet.heading('אנשי מקצוע')
    sheet.table(
      ['תפקיד', 'שם', 'טלפון', 'ארגון'],
      file.professionals.map((link) => [
        labelOf(PROFESSIONAL_ROLE, link.roleInFile),
        link.professional.name,
        text(link.professional.phone),
        text(link.professional.organization),
      ]),
      [0.22, 0.28, 0.22, 0.28],
    )
  }

  // The flag is the office's own decision about what the bank should see. If
  // nobody has marked anything, sending an empty folder helps no one — so
  // everything with a file goes in, and the cover says that is what happened.
  const withFiles = file.documents.filter((doc) => doc.storagePath)
  const marked = withFiles.filter((doc) => doc.allowedForBank)
  const chosen = marked.length ? marked : withFiles
  const usingFallback = !marked.length && withFiles.length > 0

  sheet.heading('המסמכים המצורפים')
  if (!chosen.length) {
    sheet.note('אין בתיק מסמכים עם קובץ מצורף.')
  } else {
    sheet.table(
      ['#', 'סוג המסמך', 'סטטוס', 'התקבל', 'תוקף'],
      chosen.map((doc) => [
        String(doc.seq),
        doc.docType,
        labelOf(DOCUMENT_STATUS, doc.status),
        date(doc.receivedAt),
        date(doc.expiresAt),
      ]),
      [0.07, 0.37, 0.2, 0.18, 0.18],
    )
    if (usingFallback) {
      sheet.note('לא סומנו מסמכים לחבילת הבנק, ולכן צורפו כל המסמכים שיש להם קובץ.')
    }
  }

  // --- the documents themselves
  const skipped: string[] = []
  let attached = 0

  for (const doc of chosen) {
    const extension = path.extname(doc.storagePath!).toLowerCase()
    if (!MERGEABLE.has(extension)) {
      skipped.push(`${doc.docType} (${extension || 'ללא סיומת'})`)
      continue
    }

    let bytes: Buffer
    try {
      bytes = await readFile(resolveStored(doc.storagePath!))
    } catch {
      skipped.push(`${doc.docType} — הקובץ חסר`)
      continue
    }

    try {
      if (extension === '.pdf') {
        const source = await PDFDocument.load(bytes, { ignoreEncryption: true })
        const pages = await pdf.copyPages(source, source.getPageIndices())
        for (const page of pages) pdf.addPage(page)
      } else {
        const image =
          extension === '.png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
        const page = pdf.addPage([A4.width, A4.height])
        const room = { width: A4.width - MARGIN * 2, height: A4.height - MARGIN * 2 }
        const scale = Math.min(room.width / image.width, room.height / image.height, 1)
        const width = image.width * scale
        const height = image.height * scale
        page.drawImage(image, {
          x: (A4.width - width) / 2,
          y: (A4.height - height) / 2,
          width,
          height,
        })
      }
      attached += 1
    } catch {
      // A corrupt or password-protected file must not take the whole package
      // down; it is listed instead so the office knows to send it separately.
      skipped.push(`${doc.docType} — הקובץ לא נקרא`)
    }
  }

  if (skipped.length) {
    const closing = new Sheet(pdf, font, bold)
    closing.heading('מסמכים שלא צורפו')
    closing.note('יש לשלוח אותם בנפרד:')
    for (const item of skipped) closing.note(`• ${item}`)
  }

  pdf.setTitle(`תיק ${file.fileNumber} — ${file.client.fullName}`)
  pdf.setCreator('Mortgage OS')

  return {
    bytes: await pdf.save(),
    fileName: `תיק ${file.fileNumber} — ${file.client.fullName}.pdf`,
    asciiName: `file-${file.fileNumber.replace(/[^\w.-]/g, '-')}.pdf`,
    attached,
    skipped,
  }
}

/**
 * Reading a spreadsheet the office was sent.
 *
 * Excel is read by a library, which is loaded only when someone actually
 * opens the import screen — it is a large thing to carry on every page load
 * for a job most days never need. CSV is handled here: it is a small format,
 * and a dependency for it would not earn its place.
 */

export type Sheet = {
  name: string
  /** The first row, taken as the column names. */
  headers: string[]
  /** Every row after it, already aligned to the headers. */
  rows: CellValue[][]
}

export type CellValue = string | number | boolean | Date | null

/** What a file could not be read as, in words a person can act on. */
export class SheetError extends Error {}

const isBlank = (row: CellValue[]) =>
  row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '')

/**
 * A header row can hold blanks and repeats. Both are given names here rather
 * than left to collide, because the mapping screen addresses columns by name.
 */
function nameHeaders(raw: CellValue[]): string[] {
  const used = new Map<string, number>()
  return raw.map((cell, i) => {
    const base = String(cell ?? '').trim() || `עמודה ${i + 1}`
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)
    return seen === 0 ? base : `${base} (${seen + 1})`
  })
}

function toSheet(name: string, grid: CellValue[][]): Sheet {
  const rows = grid.filter((row) => !isBlank(row))
  if (rows.length === 0) return { name, headers: [], rows: [] }

  const headers = nameHeaders(rows[0])
  const body = rows.slice(1).map((row) => headers.map((_, i) => row[i] ?? null))
  return { name, headers, rows: body }
}

/**
 * Splits one CSV line-set into a grid. Quotes protect commas and newlines,
 * and a doubled quote inside a quoted field is a literal one — the rules a
 * spreadsheet writes by, so a file it exported reads back unchanged.
 */
function parseCsv(text: string): CellValue[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  // Excel writes a byte-order mark; left in place it becomes part of the
  // first column's name and no header ever matches.
  const source = text.replace(/^﻿/, '')

  for (let i = 0; i < source.length; i++) {
    const char = source[i]

    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += char
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }

  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.map((r) => r.map((cell) => cell.trim()))
}

/** Reads a file into one sheet per tab. Excel keeps its tabs; CSV has one. */
export async function readSheets(file: File): Promise<Sheet[]> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text()
    const sheet = toSheet(file.name, parseCsv(text))
    if (!sheet.headers.length) throw new SheetError('הקובץ ריק')
    return [sheet]
  }

  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    throw new SheetError('אפשר לייבא קובץ Excel (‎.xlsx‎) או CSV בלבד')
  }

  // .xls is the old binary format, which this reader cannot open. Saying so
  // beats an unexplained parse failure a minute later.
  if (name.endsWith('.xls')) {
    throw new SheetError('הקובץ בפורמט הישן (‎.xls‎). יש לשמור אותו כ-‎.xlsx‎ ולנסות שוב')
  }

  const { default: readXlsxFile } = await import('read-excel-file/browser')

  let workbook: { sheet: string; data: unknown[][] }[]
  try {
    workbook = await readXlsxFile(file)
  } catch {
    throw new SheetError('לא הצלחנו לקרוא את הקובץ. ייתכן שהוא פגום או מוגן בסיסמה')
  }

  const sheets = workbook.map((tab) => toSheet(tab.sheet, tab.data as CellValue[][]))
  if (!sheets.some((s) => s.headers.length)) {
    throw new SheetError('לא נמצאה טבלה עם כותרות בקובץ')
  }
  return sheets
}

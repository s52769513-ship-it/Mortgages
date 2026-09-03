import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http.js'


const CKAN = 'https://data.gov.il/api/3/action'
const PAGE_SIZE = 1000

type Row = Record<string, unknown>

/**
 * Field names in the published dataset are not guaranteed, and have changed
 * before. Rather than pinning one spelling, look for the first key that
 * matches any of the candidates.
 */
function pick(row: Row, ...candidates: string[]) {
  const keys = Object.keys(row)
  for (const candidate of candidates) {
    const key = keys.find((k) => k.toLowerCase().replace(/[\s_-]/g, '') === candidate)
    if (key === undefined) continue
    const value = row[key]
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text && text !== '0') return text
  }
  return null
}

async function ckan<T>(path: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${CKAN}/${path}`)
  } catch {
    // Worth naming plainly: the usual cause is the host having no outbound
    // access to data.gov.il, not a bug in the import.
    throw new HttpError(502, 'לא הצלחנו להגיע ל-data.gov.il. בדוק שיש לשרת גישה לאינטרנט.')
  }

  if (!res.ok) {
    throw new HttpError(502, `data.gov.il החזיר שגיאה ${res.status}. נסה שוב מאוחר יותר.`)
  }

  let body: { success: boolean; result: T }
  try {
    body = (await res.json()) as { success: boolean; result: T }
  } catch {
    throw new HttpError(502, 'data.gov.il החזיר תשובה שאינה JSON. ייתכן שהשירות מושבת זמנית.')
  }

  if (!body?.success) throw new HttpError(502, 'data.gov.il דחה את הבקשה.')
  return body.result
}

/** Finds the branch dataset by search, so no resource id has to be pinned here. */
async function findResourceId() {
  const override = process.env.BANK_BRANCHES_RESOURCE_ID?.trim()
  if (override) return override

  const result = await ckan<{
    results: { title: string; resources: { id: string; format: string; datastore_active?: boolean }[] }[]
  }>(`package_search?q=${encodeURIComponent('סניפי בנקים')}&rows=10`)

  for (const pkg of result.results) {
    const resource = pkg.resources.find((r) => r.datastore_active)
    if (resource) {
      console.log(`Using dataset: ${pkg.title}`)
      return resource.id
    }
  }
  throw new HttpError(
    502,
    'לא נמצא מאגר סניפי הבנקים ב-data.gov.il. אפשר לציין אותו במפורש דרך BANK_BRANCHES_RESOURCE_ID.',
  )
}

async function fetchAllRows(resourceId: string) {
  const rows: Row[] = []
  let offset = 0

  for (;;) {
    const page = await ckan<{ records: Row[]; total: number }>(
      `datastore_search?resource_id=${resourceId}&limit=${PAGE_SIZE}&offset=${offset}`,
    )
    rows.push(...page.records)
    offset += page.records.length

    if (page.records.length === 0 || offset >= page.total) break
    console.log(`  fetched ${offset} / ${page.total}`)
  }

  return rows
}


export type ImportSummary = {
  banks: number
  branches: number
  skipped: number
  failed: number
  firstFailure?: string
}

/** Pulls the published bank and branch list into our tables. Safe to re-run. */
export async function importBanks(): Promise<ImportSummary> {
  const resourceId = await findResourceId()
  const rows = await fetchAllRows(resourceId)

  if (rows.length === 0) return { banks: 0, branches: 0, skipped: 0, failed: 0 }

  console.log(`Fetched ${rows.length} rows. Columns: ${Object.keys(rows[0]).join(', ')}`)

  let banks = 0
  let branches = 0
  let skipped = 0
  let failed = 0
  let firstFailure: string | null = null

  // One bank has many branches; cache so each bank is written once.
  const bankIdByCode = new Map<string, string>()

  for (const row of rows) {
    const bankName = pick(row, 'bankname', 'שםבנק', 'שםהבנק')
    const bankCode = pick(row, 'bankcode', 'קודבנק', 'מספרבנק')

    if (!bankName) {
      skipped++
      continue
    }

    const cacheKey = bankCode ?? bankName
    let bankId = bankIdByCode.get(cacheKey)

    if (!bankId) {
      try {
        const bank = await prisma.bank.upsert({
          where: { name: bankName },
          update: bankCode ? { code: bankCode } : {},
          create: { name: bankName, code: bankCode },
        })
        bankId = bank.id
        bankIdByCode.set(cacheKey, bankId)
        banks++
      } catch (e) {
        failed++
        firstFailure ??= `בנק "${bankName}": ${e instanceof Error ? e.message : String(e)}`
        continue
      }
    }

    const branchCode = pick(row, 'branchcode', 'קודסניף', 'מספרסניף')
    const branchName =
      pick(row, 'branchname', 'שםסניף', 'שםהסניף') ?? (branchCode ? `סניף ${branchCode}` : null)

    if (!branchName) {
      skipped++
      continue
    }

    const city = pick(row, 'city', 'עיר', 'ישוב', 'יישוב')
    // Some editions carry a single address column, others split it into parts.
    const street = [pick(row, 'street', 'רחוב'), pick(row, 'housenumber', 'מספרבית')]
      .filter(Boolean)
      .join(' ')
    const address = pick(row, 'branchaddress', 'address', 'כתובת', 'כתובתסניף') ?? (street || null)
    const phone = pick(row, 'telephone', 'phone', 'טלפון')

    try {
      await prisma.bankBranch.upsert({
        where: { bankId_name: { bankId, name: branchName } },
        update: { code: branchCode, city, address, phone },
        create: { bankId, name: branchName, code: branchCode, city, address, phone },
      })
      branches++
    } catch (e) {
      failed++
      firstFailure ??= `סניף "${branchName}": ${e instanceof Error ? e.message : String(e)}`
    }
  }

  return { banks, branches, skipped, failed, ...(firstFailure ? { firstFailure } : {}) }
}

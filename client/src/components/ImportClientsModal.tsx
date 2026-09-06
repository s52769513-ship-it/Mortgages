import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'
import { readSheets, SheetError, type CellValue, type Sheet } from '@/lib/sheet'
import {
  CLIENT_TARGETS,
  convert,
  convertCustom,
  guessTarget,
  targetOf,
  type Mapping,
} from '@/lib/clientImport'
import type { CustomField } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

/**
 * Importing a list of clients from a spreadsheet.
 *
 * The work is in the middle step. Every office keeps its list in its own
 * shape, so nothing is guessed silently: each column is shown with what is
 * actually in it, next to the field it will become, and a column that fits
 * nothing can be made into a field of its own rather than dropped. Losing a
 * column on import means losing the only copy the office had of it.
 */

const NEW_FIELD_TYPES = [
  { value: 'TEXT', label: 'טקסט' },
  { value: 'NUMBER', label: 'מספר' },
  { value: 'DATE', label: 'תאריך' },
  { value: 'BOOLEAN', label: 'כן / לא' },
] as const

type ImportOutcome = {
  created: { index: number }[]
  skipped: { index: number; reason: string }[]
  failed: { index: number; message: string }[]
}

/** Rows go up in batches: one huge request is one huge thing to lose. */
const BATCH = 200

const cellText = (value: CellValue) =>
  value instanceof Date ? value.toLocaleDateString('he-IL') : String(value ?? '')

export function ImportClientsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'file' | 'map' | 'done'>('file')
  const [reading, setReading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState<Sheet[] | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [onDuplicate, setOnDuplicate] = useState<'skip' | 'create'>('skip')
  const [problem, setProblem] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)

  const { data: fields } = useQuery({
    queryKey: ['custom-fields', 'CLIENT'],
    queryFn: () => api.get<{ items: CustomField[] }>('/custom-fields?entity=CLIENT'),
    enabled: open,
  })
  const customFields = fields?.items ?? []

  // Reopening starts clean; a mapping from a previous file would be nonsense.
  useEffect(() => {
    if (!open) return
    setStep('file')
    setSheets(null)
    setSheetIndex(0)
    setMappings([])
    setFileName('')
    setProblem(null)
    setProgress(null)
    setOutcome(null)
  }, [open])

  const sheet = sheets?.[sheetIndex] ?? null

  /** First guess at where each column belongs, made once per sheet. */
  const guessFor = (target: Sheet): Mapping[] => {
    const taken = new Set<string>()
    return target.headers.map((header) => {
      const existing = customFields.find((f) => f.label.trim() === header.trim())
      if (existing) return { kind: 'custom', fieldId: existing.id } as Mapping
      const key = guessTarget(header, taken)
      if (!key) return { kind: 'ignore' } as Mapping
      taken.add(key)
      return { kind: 'target', key } as Mapping
    })
  }

  const pickFile = async (file: File) => {
    setReading(true)
    setProblem(null)
    try {
      const parsed = await readSheets(file)
      const first = parsed.findIndex((s) => s.headers.length > 0)
      setSheets(parsed)
      setSheetIndex(first === -1 ? 0 : first)
      setFileName(file.name)
      setMappings(guessFor(parsed[first === -1 ? 0 : first]))
      setStep('map')
    } catch (error) {
      setProblem(
        error instanceof SheetError ? error.message : 'לא הצלחנו לקרוא את הקובץ',
      )
    } finally {
      setReading(false)
    }
  }

  const chooseSheet = (index: number) => {
    if (!sheets) return
    setSheetIndex(index)
    setMappings(guessFor(sheets[index]))
  }

  const setMapping = (column: number, mapping: Mapping) =>
    setMappings((current) => current.map((m, i) => (i === column ? mapping : m)))

  /** A system field can only be filled from one column. */
  const takenTargets = useMemo(
    () => new Set(mappings.flatMap((m) => (m.kind === 'target' ? [m.key] : []))),
    [mappings],
  )

  const mappedName = mappings.some((m) => m.kind === 'target' && m.key === 'fullName')
  const mappedPhone = mappings.some((m) => m.kind === 'target' && m.key === 'phone')

  /**
   * What the sheet looks like once mapped: how many rows can be saved, and
   * which cannot. Shown before anything is written, because a person who can
   * see three bad rows will go and fix them.
   */
  const review = useMemo(() => {
    if (!sheet || !mappedName || !mappedPhone) return null

    const nameCol = mappings.findIndex((m) => m.kind === 'target' && m.key === 'fullName')
    const phoneCol = mappings.findIndex((m) => m.kind === 'target' && m.key === 'phone')
    const nameTarget = targetOf('fullName')!
    const phoneTarget = targetOf('phone')!

    const incomplete: number[] = []
    const repeated: number[] = []
    const phones = new Set<string>()
    let ready = 0

    sheet.rows.forEach((row, i) => {
      const name = convert(row[nameCol], nameTarget)
      const phone = convert(row[phoneCol], phoneTarget)
      if (typeof name !== 'string' || name.trim().length < 2 || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 6) {
        incomplete.push(i)
        return
      }
      const digits = phone.replace(/\D/g, '')
      if (phones.has(digits)) {
        repeated.push(i)
        return
      }
      phones.add(digits)
      ready++
    })

    return { ready, incomplete, repeated }
  }, [sheet, mappings, mappedName, mappedPhone])

  /**
   * Builds the payload for one sheet row. The mapping is passed in rather
   * than read from state: a column that has just become a real field was
   * only rewritten a moment ago, and state has not caught up yet.
   */
  const rowPayload = (
    row: CellValue[],
    resolved: Mapping[],
    known: Map<string, { key: string; type: string }>,
  ) => {
    const data: Record<string, unknown> = {}
    const custom: Record<string, unknown> = {}

    resolved.forEach((mapping, column) => {
      const cell = row[column]
      if (mapping.kind === 'target') {
        const target = targetOf(mapping.key)
        if (!target) return
        const value = convert(cell, target)
        if (value !== undefined) data[mapping.key] = value
      } else if (mapping.kind === 'custom') {
        const field = known.get(mapping.fieldId)
        if (!field) return
        const value = convertCustom(cell, field.type)
        if (value !== undefined) custom[field.key] = value
      }
    })

    if (Object.keys(custom).length) data.custom = custom
    return data
  }

  const run = async () => {
    if (!sheet) return
    setProblem(null)
    setProgress({ done: 0, total: sheet.rows.length })

    try {
      // Columns marked as a new field become real fields first, so the rows
      // that follow have somewhere to land.
      const known = new Map(customFields.map((f) => [f.id, { key: f.key, type: f.type as string }]))
      const resolved = [...mappings]
      for (let i = 0; i < resolved.length; i++) {
        const mapping = resolved[i]
        if (mapping.kind !== 'new') continue
        const created = await api.post<CustomField>('/custom-fields', {
          entityType: 'CLIENT',
          label: mapping.label,
          type: mapping.type,
        })
        known.set(created.id, { key: created.key, type: created.type })
        resolved[i] = { kind: 'custom', fieldId: created.id }
      }
      if (resolved.some((m, i) => m !== mappings[i])) setMappings(resolved)

      const rows = sheet.rows.map((row, index) => ({
        index,
        data: rowPayload(row, resolved, known),
      }))
      const totals: ImportOutcome = { created: [], skipped: [], failed: [] }

      for (let start = 0; start < rows.length; start += BATCH) {
        const batch = rows.slice(start, start + BATCH)
        const result = await api.post<ImportOutcome>('/clients/import', {
          rows: batch,
          onDuplicate,
        })
        totals.created.push(...result.created)
        totals.skipped.push(...result.skipped)
        totals.failed.push(...result.failed)
        setProgress({ done: Math.min(start + BATCH, rows.length), total: rows.length })
      }

      setOutcome(totals)
      setStep('done')
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] })
      if (totals.created.length) notify(`${totals.created.length} לקוחות נוספו`)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'הייבוא נכשל')
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      size="lg"
      title="ייבוא לקוחות מקובץ"
      description={
        step === 'file'
          ? 'קובץ Excel או CSV — השורה הראשונה היא הכותרות.'
          : step === 'map'
            ? `${fileName} · התאמת העמודות לשדות המערכת`
            : 'סיכום הייבוא'
      }
      footer={
        step === 'file' ? (
          <Button variant="secondary" onClick={onClose}>
            סגור
          </Button>
        ) : step === 'map' ? (
          <>
            <Button variant="secondary" onClick={() => setStep('file')} disabled={busy}>
              קובץ אחר
            </Button>
            <Button
              onClick={run}
              loading={busy}
              loadingLabel={progress ? `מייבא ${progress.done}/${progress.total}…` : 'מייבא…'}
              disabled={!review || review.ready === 0}
            >
              ייבא {review?.ready ?? 0} לקוחות
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>סיום</Button>
        )
      }
    >
      {problem && (
        <div className="mb-4 flex gap-2.5 rounded-md bg-urgent-tint px-4 py-3 text-[13.5px] text-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-urgent-ink" />
          {problem}
        </div>
      )}

      {step === 'file' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className={cn(
              'flex w-full flex-col items-center gap-3 rounded-lg border border-dashed border-field',
              'bg-paper px-6 py-12 text-center transition-colors duration-micro ease-standard',
              'hover:border-steel-600 hover:bg-ink/[0.02]',
            )}
          >
            <FileSpreadsheet className="size-8 text-ink-subtle" />
            <span className="text-[15px] font-medium text-ink">
              {reading ? 'קורא את הקובץ…' : 'בחר קובץ לייבוא'}
            </span>
            <span className="text-[13px] text-ink-muted">‎.xlsx‎ או ‎.csv‎</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void pickFile(file)
            }}
          />
          <ul className="space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
            <li>· השורה הראשונה בגיליון היא שמות העמודות.</li>
            <li>· שם וטלפון הם השדות ההכרחיים; כל השאר לא חובה.</li>
            <li>· עמודה שאין לה שדה מתאים אפשר להפוך לשדה חדש במערכת.</li>
            <li>· לקוח שהטלפון שלו כבר קיים ידולג, אלא אם תבחר אחרת.</li>
          </ul>
        </div>
      )}

      {step === 'map' && sheet && (
        <div className="space-y-5">
          {sheets && sheets.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold text-ink-muted">גיליון:</span>
              {sheets.map((s, i) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => chooseSheet(i)}
                  disabled={!s.headers.length}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[13px] transition-colors duration-micro',
                    i === sheetIndex
                      ? 'bg-steel-600 text-white'
                      : 'text-ink-muted hover:bg-ink/[0.05] disabled:opacity-40',
                  )}
                >
                  {s.name}
                  {s.headers.length > 0 && ` (${s.rows.length})`}
                </button>
              ))}
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-row">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-paper text-[12px] font-semibold text-ink-muted">
                  <th className="px-4 py-2.5 text-start">עמודה בקובץ</th>
                  <th className="px-4 py-2.5 text-start">דוגמה</th>
                  <th className="px-4 py-2.5 text-start">שדה במערכת</th>
                </tr>
              </thead>
              <tbody>
                {sheet.headers.map((header, column) => {
                  const mapping = mappings[column] ?? { kind: 'ignore' }
                  const samples = sheet.rows
                    .slice(0, 8)
                    .map((row) => cellText(row[column]))
                    .filter(Boolean)
                    .slice(0, 2)

                  return (
                    <tr key={header} className="border-t border-row align-top">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-ink">{header}</span>
                      </td>
                      <td className="max-w-[190px] px-4 py-2.5 text-ink-subtle">
                        <span className="block truncate">{samples.join(' · ') || '—'}</span>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={
                            mapping.kind === 'target'
                              ? `t:${mapping.key}`
                              : mapping.kind === 'custom'
                                ? `c:${mapping.fieldId}`
                                : mapping.kind === 'new'
                                  ? 'new'
                                  : 'ignore'
                          }
                          onChange={(e) => {
                            const value = e.target.value
                            if (value === 'ignore') setMapping(column, { kind: 'ignore' })
                            else if (value === 'new')
                              setMapping(column, { kind: 'new', label: header, type: 'TEXT' })
                            else if (value.startsWith('t:'))
                              setMapping(column, { kind: 'target', key: value.slice(2) })
                            else setMapping(column, { kind: 'custom', fieldId: value.slice(2) })
                          }}
                          className={cn(
                            'h-9 w-full cursor-pointer rounded-md border border-field bg-surface px-2',
                            'text-[13.5px] text-ink transition-colors duration-micro',
                            'focus:border-steel-600',
                          )}
                        >
                          <option value="ignore">— אל תייבא —</option>
                          <optgroup label="שדות המערכת">
                            {CLIENT_TARGETS.map((target) => (
                              <option
                                key={target.key}
                                value={`t:${target.key}`}
                                disabled={
                                  takenTargets.has(target.key) &&
                                  !(mapping.kind === 'target' && mapping.key === target.key)
                                }
                              >
                                {target.label}
                                {target.required ? ' *' : ''}
                              </option>
                            ))}
                          </optgroup>
                          {customFields.length > 0 && (
                            <optgroup label="שדות שהוספתם">
                              {customFields.map((field) => (
                                <option key={field.id} value={`c:${field.id}`}>
                                  {field.label}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <option value="new">＋ צור שדה חדש…</option>
                        </select>

                        {mapping.kind === 'new' && (
                          <div className="mt-2 flex gap-2">
                            <input
                              value={mapping.label}
                              onChange={(e) =>
                                setMapping(column, { ...mapping, label: e.target.value })
                              }
                              placeholder="שם השדה"
                              aria-label={`שם השדה החדש עבור ${header}`}
                              className="h-9 min-w-0 flex-1 rounded-md border border-field bg-surface px-2 text-[13.5px] focus:border-steel-600"
                            />
                            <select
                              value={mapping.type}
                              onChange={(e) =>
                                setMapping(column, {
                                  ...mapping,
                                  type: e.target.value as typeof mapping.type,
                                })
                              }
                              aria-label={`סוג השדה החדש עבור ${header}`}
                              className="h-9 cursor-pointer rounded-md border border-field bg-surface px-2 text-[13.5px] focus:border-steel-600"
                            >
                              {NEW_FIELD_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {(!mappedName || !mappedPhone) && (
            <p className="flex items-center gap-2 text-[13.5px] text-urgent-ink">
              <TriangleAlert className="size-4 shrink-0" />
              יש לבחור עמודה עבור {!mappedName ? 'שם מלא' : ''}
              {!mappedName && !mappedPhone ? ' ועבור ' : ''}
              {!mappedPhone ? 'טלפון' : ''}.
            </p>
          )}

          {review && (
            <div className="space-y-2 rounded-lg bg-paper px-4 py-3.5 text-[13.5px] leading-relaxed">
              <p className="text-ink">
                <span className="font-semibold">{review.ready}</span> מתוך {sheet.rows.length}{' '}
                שורות מוכנות לייבוא.
              </p>
              {review.incomplete.length > 0 && (
                <p className="text-ink-muted">
                  {review.incomplete.length} שורות ידולגו — חסר בהן שם או טלפון (שורות{' '}
                  {review.incomplete.slice(0, 6).map((i) => i + 2).join(', ')}
                  {review.incomplete.length > 6 ? ' ועוד' : ''} בקובץ).
                </p>
              )}
              {review.repeated.length > 0 && (
                <p className="text-ink-muted">
                  {review.repeated.length} שורות חוזרות על טלפון שכבר מופיע בקובץ עצמו, וייובאו
                  פעם אחת בלבד.
                </p>
              )}
              <label className="flex cursor-pointer items-center gap-2 pt-1 text-ink">
                <input
                  type="checkbox"
                  checked={onDuplicate === 'create'}
                  onChange={(e) => setOnDuplicate(e.target.checked ? 'create' : 'skip')}
                  className="size-4 accent-[rgb(var(--steel-600))]"
                />
                ייבא גם לקוח שהטלפון שלו כבר קיים במערכת
              </label>
            </div>
          )}
        </div>
      )}

      {step === 'done' && outcome && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-ok-tint px-4 py-3.5">
            <CheckCircle2 className="size-5 shrink-0 text-ok-ink" />
            <p className="text-[15px] text-ink">
              <span className="font-semibold">{outcome.created.length}</span> לקוחות נוספו למערכת.
            </p>
          </div>

          {outcome.skipped.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[13.5px] font-semibold text-ink">
                {outcome.skipped.length} שורות דולגו
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-[13px] text-ink-muted">
                {outcome.skipped.slice(0, 40).map((s) => (
                  <li key={s.index}>שורה {s.index + 2}: {s.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {outcome.failed.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[13.5px] font-semibold text-urgent-ink">
                {outcome.failed.length} שורות נכשלו
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-[13px] text-ink-muted">
                {outcome.failed.slice(0, 40).map((f) => (
                  <li key={f.index}>שורה {f.index + 2}: {f.message}</li>
                ))}
              </ul>
              <p className="text-[12.5px] text-ink-subtle">
                אפשר לתקן את השורות האלה בקובץ ולייבא אותו שוב — מה שכבר נכנס לא ייכפל.
              </p>
            </div>
          )}
        </div>
      )}

      {step === 'file' && reading && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-muted">
          <Upload className="size-4 animate-pulse" />
          קורא את הקובץ…
        </p>
      )}
    </Modal>
  )
}

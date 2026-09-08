import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Lock, Plus, Settings as SettingsIcon, X } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { FILE_STATUS, type Tone } from '@/lib/labels'
import { TONE_SWATCHES } from '@/lib/fileStatusColor'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, DOTS } from '@/components/ui/Badge'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'

/**
 * Office-wide configuration, one card per setting: the financing percentages
 * and deal types offered on a file, the lenders the office actually works
 * with, and the colour each file status renders in.
 *
 * Read-only for everyone, editable only by an admin, the same split the
 * users list uses: seeing what is configured is not a risk, changing it is.
 */
export function SettingsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Record<string, unknown>>('/settings'),
  })

  if (error) return <ErrorState message="לא הצלחנו לטעון את ההגדרות." onRetry={() => refetch()} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2.5 font-heading text-[32px] font-bold leading-tight text-ink">
          <SettingsIcon className="size-7 text-ink-subtle" />
          הגדרות
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">מה מוצע מראש בטפסים, ברחבי המערכת.</p>
      </div>

      <PercentListCard isAdmin={isAdmin} isLoading={isLoading} values={data?.ltvPresets} />
      <TextListCard
        isAdmin={isAdmin}
        isLoading={isLoading}
        values={data?.dealTypes}
        settingKey="dealTypes"
        title="סוגי עסקה להצעה מהירה"
        subtitle="הרשימה שמוצעת לבחירה בפתיחת תיק ובעריכתו, בסדר שבו הוספתם אותה."
        addLabel="סוג עסקה חדש"
        placeholder="למשל החלפת בנק מלווה"
        emptyText="אין עדיין סוגי עסקה ברשימה — הוסיפו למטה."
        duplicateText="סוג העסקה הזה כבר ברשימה"
      />
      <TextListCard
        isAdmin={isAdmin}
        isLoading={isLoading}
        values={data?.banks}
        settingKey="banks"
        title="בנקים שהמשרד עובד מולם"
        subtitle="רק הבנקים כאן מוצעים לבחירה בפתיחת תיק ובבקשה לבנק, בסדר שבו הוספתם אותם."
        addLabel="בנק חדש"
        placeholder="למשל לאומי"
        emptyText="אין עדיין בנקים ברשימה — הוסיפו למטה."
        duplicateText="הבנק הזה כבר ברשימה"
      />
      <StatusColorsCard isAdmin={isAdmin} isLoading={isLoading} values={data?.fileStatusColors} />

      {!isAdmin && (
        <EmptyState
          icon={<Lock className="size-6" />}
          title="שינוי הגדרות שמור למנהל המערכת"
          description="הרשימות כאן זמינות לצפייה לכולם; רק מנהל יכול להוסיף או להסיר מהן."
        />
      )}
    </div>
  )
}

/** One removable pill, admin-only close button included. */
function Chip({
  children,
  onRemove,
  removing,
  dir,
}: {
  children: React.ReactNode
  onRemove?: () => void
  removing?: boolean
  dir?: 'ltr' | 'rtl'
}) {
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-field py-1.5 text-[14px] font-medium text-ink',
        onRemove ? 'ps-3.5 pe-2' : 'px-3.5',
      )}
      dir={dir}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label="הסר"
          onClick={onRemove}
          disabled={removing}
          className="rounded p-0.5 text-ink-subtle transition-colors duration-micro hover:bg-urgent-tint hover:text-urgent-ink disabled:opacity-50"
        >
          <X className="size-3.5" />
        </button>
      )}
    </span>
  )
}

/** Financing percentages: a plain number, sorted low to high after every edit. */
function PercentListCard({
  isAdmin,
  isLoading,
  values,
}: {
  isAdmin: boolean
  isLoading: boolean
  values: unknown
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const presets = Array.isArray(values) ? (values as number[]) : []

  const save = useMutation({
    mutationFn: (next: number[]) =>
      api.patch<{ value: number[] }>('/settings/ltvPresets', { value: next }),
    onSuccess: (result) => {
      queryClient.setQueryData(['settings'], (prev: Record<string, unknown> | undefined) => ({
        ...(prev ?? {}),
        ltvPresets: result.value,
      }))
    },
    onError: (e: Error) => notify('העדכון נכשל', { tone: 'error', detail: e.message }),
  })

  const add = () => {
    const value = Number(draft)
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      notify('אחוז חייב להיות מספר שלם בין 1 ל-100', { tone: 'error' })
      return
    }
    if (presets.includes(value)) {
      notify('האחוז הזה כבר ברשימה', { tone: 'error' })
      return
    }
    setDraft('')
    save.mutate([...presets, value].sort((a, b) => a - b))
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="אחוזי מימון להצעה מהירה"
        subtitle="מוצגים כבחירה אחת-קליק בתיק ובבקשה לבנק. כל אחוז אחר עדיין ניתן להקליד ידנית."
      />
      {isLoading ? (
        <div className="p-6">
          <Skeleton className="h-9 w-2/3" />
        </div>
      ) : !isAdmin ? (
        <div className="flex flex-wrap gap-2 px-6 py-5">
          {presets.length === 0 ? (
            <p className="text-[14px] text-ink-muted">אין עדיין אחוזים מוגדרים.</p>
          ) : (
            presets.map((p) => (
              <Chip key={p} dir="ltr">
                {p}%
              </Chip>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Chip
                key={p}
                dir="ltr"
                removing={save.isPending}
                onRemove={() => save.mutate(presets.filter((x) => x !== p))}
              >
                <span className="numeric">{p}%</span>
              </Chip>
            ))}
            {presets.length === 0 && (
              <p className="text-[14px] text-ink-muted">אין עדיין אחוזים ברשימה — הוסיפו למטה.</p>
            )}
          </div>

          <div className="flex items-end gap-2.5">
            <div className="w-32">
              <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">
                אחוז חדש
              </label>
              <input
                type="number"
                min={1}
                max={100}
                dir="ltr"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="למשל 75"
                className={cn(
                  'numeric h-10 w-full rounded-md border border-field bg-surface px-3 text-[15px] text-ink',
                  'placeholder:text-ink-faint transition-colors duration-micro ease-standard',
                  'focus:border-steel-600',
                )}
              />
            </div>
            <AddButton onClick={add} disabled={!draft.trim() || save.isPending} />
          </div>
        </div>
      )}
    </Card>
  )
}

/** Any free-text list setting: order is the office's own, kept as entered. */
function TextListCard({
  isAdmin,
  isLoading,
  values,
  settingKey,
  title,
  subtitle,
  addLabel,
  placeholder,
  emptyText,
  duplicateText,
}: {
  isAdmin: boolean
  isLoading: boolean
  values: unknown
  settingKey: string
  title: string
  subtitle: string
  addLabel: string
  placeholder: string
  emptyText: string
  duplicateText: string
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const types = Array.isArray(values) ? (values as string[]) : []

  const save = useMutation({
    mutationFn: (next: string[]) =>
      api.patch<{ value: string[] }>(`/settings/${settingKey}`, { value: next }),
    onSuccess: (result) => {
      queryClient.setQueryData(['settings'], (prev: Record<string, unknown> | undefined) => ({
        ...(prev ?? {}),
        [settingKey]: result.value,
      }))
      // The bank pickers read this list, so they have to see the new one.
      queryClient.invalidateQueries({ queryKey: ['banks'] })
    },
    onError: (e: Error) => notify('העדכון נכשל', { tone: 'error', detail: e.message }),
  })

  const add = () => {
    const value = draft.trim()
    if (!value) return
    if (types.includes(value)) {
      notify(duplicateText, { tone: 'error' })
      return
    }
    setDraft('')
    save.mutate([...types, value])
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} subtitle={subtitle} />
      {isLoading ? (
        <div className="p-6">
          <Skeleton className="h-9 w-2/3" />
        </div>
      ) : !isAdmin ? (
        <div className="flex flex-wrap gap-2 px-6 py-5">
          {types.length === 0 ? (
            <p className="text-[14px] text-ink-muted">{emptyText}</p>
          ) : (
            types.map((t) => <Chip key={t}>{t}</Chip>)
          )}
        </div>
      ) : (
        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <Chip key={t} removing={save.isPending} onRemove={() => save.mutate(types.filter((x) => x !== t))}>
                {t}
              </Chip>
            ))}
            {types.length === 0 && (
              <p className="text-[14px] text-ink-muted">{emptyText}</p>
            )}
          </div>

          <div className="flex items-end gap-2.5">
            <div className="max-w-xs flex-1">
              <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">
                {addLabel}
              </label>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder={placeholder}
                className={cn(
                  'h-10 w-full rounded-md border border-field bg-surface px-3 text-[15px] text-ink',
                  'placeholder:text-ink-faint transition-colors duration-micro ease-standard',
                  'focus:border-steel-600',
                )}
              />
            </div>
            <AddButton onClick={add} disabled={!draft.trim() || save.isPending} />
          </div>
        </div>
      )}
    </Card>
  )
}

/** The five file statuses, in the order the design system defines them. */
const STATUS_KEYS = Object.keys(FILE_STATUS) as (keyof typeof FILE_STATUS)[]

/**
 * Which of the five state colours each file status renders in, everywhere a
 * file's status is shown — the table, the pipeline board, the file's own
 * page. Not a free choice of colour: the four-tone system stays exactly as
 * restrained as it always was, this only lets the office decide which
 * meaning gets which of the five.
 */
function StatusColorsCard({
  isAdmin,
  isLoading,
  values,
}: {
  isAdmin: boolean
  isLoading: boolean
  values: unknown
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const raw = values && typeof values === 'object' ? (values as Record<string, Tone>) : {}
  // Every status needs a tone to render at all, so a status the settings
  // object has not caught up with yet falls back to its built-in colour
  // rather than disappearing from the picker.
  const colors = Object.fromEntries(
    STATUS_KEYS.map((key) => [key, raw[key] ?? FILE_STATUS[key].tone]),
  ) as Record<string, Tone>

  const save = useMutation({
    mutationFn: (next: Record<string, Tone>) =>
      api.patch<{ value: Record<string, Tone> }>('/settings/fileStatusColors', { value: next }),
    onSuccess: (result) => {
      queryClient.setQueryData(['settings'], (prev: Record<string, unknown> | undefined) => ({
        ...(prev ?? {}),
        fileStatusColors: result.value,
      }))
    },
    onError: (e: Error) => notify('העדכון נכשל', { tone: 'error', detail: e.message }),
  })

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="צבעי סטטוס תיק"
        subtitle="הצבע שבו כל סטטוס מוצג — בטבלת התיקים, בצנרת ובדף התיק עצמו."
      />
      {isLoading ? (
        <div className="space-y-3 p-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      ) : !isAdmin ? (
        <div className="flex flex-wrap gap-2 px-6 py-5">
          {STATUS_KEYS.map((key) => (
            <Badge key={key} tone={colors[key]} dot>
              {FILE_STATUS[key].label}
            </Badge>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-row px-6">
          {STATUS_KEYS.map((key) => (
            <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <Badge tone={colors[key]} dot>
                {FILE_STATUS[key].label}
              </Badge>
              <div role="group" aria-label={`צבע לסטטוס ${FILE_STATUS[key].label}`} className="flex gap-1.5">
                {TONE_SWATCHES.map((swatch) => {
                  const selected = colors[key] === swatch.value
                  return (
                    <button
                      key={swatch.value}
                      type="button"
                      aria-label={swatch.label}
                      aria-pressed={selected}
                      disabled={save.isPending}
                      onClick={() => save.mutate({ ...colors, [key]: swatch.value })}
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full transition-transform duration-micro ease-standard',
                        'disabled:pointer-events-none disabled:opacity-50',
                        selected ? 'ring-2 ring-steel-600 ring-offset-2' : 'hover:scale-110',
                        DOTS[swatch.value],
                      )}
                    >
                      {selected && <Check className="size-3.5 text-white" strokeWidth={3} />}
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function AddButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-10 items-center gap-1.5 rounded-md bg-steel-600 px-4 text-[14px] font-medium text-white',
        'shadow-button transition-colors duration-micro hover:bg-steel-700 disabled:pointer-events-none disabled:opacity-45',
      )}
    >
      <Plus className="size-4" />
      הוסף
    </button>
  )
}

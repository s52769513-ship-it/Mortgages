import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Plus, Settings as SettingsIcon, X } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'

/**
 * Office-wide configuration. One card per setting today — the financing
 * percentages offered as a quick pick on a file and on a bank application —
 * with room to add another card the next time something else deserves one.
 *
 * Read-only for everyone, editable only by an admin, the same split the
 * users list uses: seeing what is configured is not a risk, changing it is.
 */
export function SettingsPage() {
  const { user } = useAuth()
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'ADMIN'

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Record<string, unknown>>('/settings'),
  })

  const [draft, setDraft] = useState('')

  const presets = Array.isArray(data?.ltvPresets) ? (data!.ltvPresets as number[]) : []

  const save = useMutation({
    mutationFn: (values: number[]) =>
      api.patch<{ value: number[] }>('/settings/ltvPresets', { value: values }),
    onSuccess: (result) => {
      queryClient.setQueryData(['settings'], (prev: Record<string, unknown> | undefined) => ({
        ...(prev ?? {}),
        ltvPresets: result.value,
      }))
    },
    onError: (e: Error) => notify('העדכון נכשל', { tone: 'error', detail: e.message }),
  })

  const addPreset = () => {
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

  const removePreset = (value: number) => save.mutate(presets.filter((p) => p !== value))

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

      <Card className="overflow-hidden">
        <CardHeader
          title="אחוזי מימון להצעה מהירה"
          subtitle="מוצגים כבחירה אחת-קליק בתיק ובבקשה לבנק. כל אחוז אחר עדיין ניתן להקליד ידנית."
        />

        {isLoading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-9 w-2/3" />
          </div>
        ) : !isAdmin ? (
          <div className="flex flex-wrap gap-2 px-6 py-5">
            {presets.length === 0 ? (
              <p className="text-[14px] text-ink-muted">אין עדיין אחוזים מוגדרים.</p>
            ) : (
              presets.map((p) => (
                <span
                  key={p}
                  className="numeric rounded-md border border-field px-3.5 py-2 text-[14px] font-medium text-ink"
                  dir="ltr"
                >
                  {p}%
                </span>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <span
                  key={p}
                  className={cn(
                    'numeric flex items-center gap-1.5 rounded-md border border-field ps-3.5 pe-2 py-1.5',
                    'text-[14px] font-medium text-ink',
                  )}
                  dir="ltr"
                >
                  {p}%
                  <button
                    type="button"
                    aria-label={`הסר את ${p}%`}
                    onClick={() => removePreset(p)}
                    disabled={save.isPending}
                    className="rounded p-0.5 text-ink-subtle transition-colors duration-micro hover:bg-urgent-tint hover:text-urgent-ink disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
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
                  onKeyDown={(e) => e.key === 'Enter' && addPreset()}
                  placeholder="למשל 75"
                  className={cn(
                    'numeric h-10 w-full rounded-md border border-field bg-surface px-3 text-[15px] text-ink',
                    'placeholder:text-ink-faint transition-colors duration-micro ease-standard',
                    'focus:border-steel-600',
                  )}
                />
              </div>
              <button
                type="button"
                onClick={addPreset}
                disabled={!draft.trim() || save.isPending}
                className={cn(
                  'flex h-10 items-center gap-1.5 rounded-md bg-steel-600 px-4 text-[14px] font-medium text-white',
                  'shadow-button transition-colors duration-micro hover:bg-steel-700 disabled:pointer-events-none disabled:opacity-45',
                )}
              >
                <Plus className="size-4" />
                הוסף
              </button>
            </div>
          </div>
        )}
      </Card>

      {!isAdmin && (
        <EmptyState
          icon={<Lock className="size-6" />}
          title="שינוי הגדרות שמור למנהל המערכת"
          description="הרשימה כאן זמינה לצפייה לכולם; רק מנהל יכול להוסיף או להסיר ממנה."
        />
      )}
    </div>
  )
}

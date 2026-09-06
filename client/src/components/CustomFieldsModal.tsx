import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'
import type { CustomField } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDelete } from '@/components/ConfirmDelete'

/**
 * The fields the office added for itself.
 *
 * They are mostly born during an import, where a column has no home; this is
 * where they can be added on purpose, renamed when the first name turns out
 * to be wrong, and removed. Removing one takes its values with it, so it
 * asks in the same way any other deletion does.
 */

const TYPES = [
  { value: 'TEXT', label: 'טקסט' },
  { value: 'NUMBER', label: 'מספר' },
  { value: 'DATE', label: 'תאריך' },
  { value: 'BOOLEAN', label: 'כן / לא' },
]

const TYPE_LABEL: Record<string, string> = {
  TEXT: 'טקסט',
  NUMBER: 'מספר',
  DATE: 'תאריך',
  BOOLEAN: 'כן / לא',
  SELECT: 'בחירה מרשימה',
}

export function CustomFieldsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notify } = useToast()
  const queryClient = useQueryClient()

  const [label, setLabel] = useState('')
  const [type, setType] = useState('TEXT')
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null)
  const [removing, setRemoving] = useState<CustomField | null>(null)

  const { data } = useQuery({
    queryKey: ['custom-fields', 'CLIENT'],
    queryFn: () => api.get<{ items: CustomField[] }>('/custom-fields?entity=CLIENT'),
    enabled: open,
  })
  const fields = data?.items ?? []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['custom-fields'] })
    queryClient.invalidateQueries({ queryKey: ['clients'] })
    queryClient.invalidateQueries({ queryKey: ['client'] })
  }

  const add = useMutation({
    mutationFn: () =>
      api.post<CustomField>('/custom-fields', { entityType: 'CLIENT', label: label.trim(), type }),
    onSuccess: () => {
      setLabel('')
      setType('TEXT')
      refresh()
      notify('השדה נוסף')
    },
    onError: (e: Error) => notify('הוספת השדה נכשלה', { tone: 'error', detail: e.message }),
  })

  const rename = useMutation({
    mutationFn: (next: { id: string; label: string }) =>
      api.patch<CustomField>(`/custom-fields/${next.id}`, { label: next.label.trim() }),
    onSuccess: () => {
      setEditing(null)
      refresh()
    },
    onError: (e: Error) => notify('שינוי השם נכשל', { tone: 'error', detail: e.message }),
  })

  const remove = useMutation({
    mutationFn: (field: CustomField) => api.delete(`/custom-fields/${field.id}`),
    onSuccess: () => {
      setRemoving(null)
      refresh()
      notify('השדה נמחק')
    },
    onError: (e: Error) => notify('מחיקת השדה נכשלה', { tone: 'error', detail: e.message }),
  })

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="שדות שהוספתם"
        description="שדות משלכם על כרטיס הלקוח, מעבר למה שהמערכת מביאה."
        footer={
          <Button variant="secondary" onClick={onClose}>
            סגור
          </Button>
        }
      >
        <div className="space-y-5">
          {fields.length === 0 ? (
            <p className="rounded-md bg-paper px-4 py-3 text-[13.5px] leading-relaxed text-ink-muted">
              עוד לא הוספתם שדות. אפשר להוסיף כאן, או ליצור שדה תוך כדי ייבוא של קובץ
              לקוחות — עמודה שאין לה שדה מתאים יכולה להפוך לשדה חדש.
            </p>
          ) : (
            <ul className="divide-y divide-row rounded-lg border border-row">
              {fields.map((field) => (
                <li key={field.id} className="flex items-center gap-3 px-4 py-2.5">
                  {editing?.id === field.id ? (
                    <>
                      <input
                        autoFocus
                        value={editing.label}
                        onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editing.label.trim()) rename.mutate(editing)
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        aria-label={`שם חדש לשדה ${field.label}`}
                        className="h-9 min-w-0 flex-1 rounded-md border border-field bg-surface px-2.5 text-[14px] focus:border-steel-600"
                      />
                      <button
                        type="button"
                        aria-label="שמור"
                        disabled={!editing.label.trim()}
                        onClick={() => rename.mutate(editing)}
                        className="rounded-md p-1.5 text-ok-ink hover:bg-ink/[0.05] disabled:opacity-40"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="בטל"
                        onClick={() => setEditing(null)}
                        className="rounded-md p-1.5 text-ink-muted hover:bg-ink/[0.05]"
                      >
                        <X className="size-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">
                        {field.label}
                      </span>
                      <span className="shrink-0 text-[12.5px] text-ink-subtle">
                        {TYPE_LABEL[field.type] ?? field.type}
                      </span>
                      <button
                        type="button"
                        aria-label={`שנה את שם השדה ${field.label}`}
                        onClick={() => setEditing({ id: field.id, label: field.label })}
                        className="rounded-md p-1.5 text-ink-muted transition-colors duration-micro hover:bg-ink/[0.05] hover:text-ink"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`מחק את השדה ${field.label}`}
                        onClick={() => setRemoving(field)}
                        className={cn(
                          'rounded-md p-1.5 text-ink-muted transition-colors duration-micro',
                          'hover:bg-urgent-tint hover:text-urgent-ink',
                        )}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3 border-t border-hair pt-5">
            <p className="text-[12px] font-semibold text-ink-muted">שדה חדש</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[180px] flex-1">
                <Input
                  label="שם השדה"
                  value={label}
                  placeholder="לדוגמה: מספר לקוח בהנהלת חשבונות"
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div className="w-40">
                <Select
                  label="סוג"
                  options={TYPES}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                />
              </div>
              <Button
                onClick={() => add.mutate()}
                disabled={!label.trim()}
                loading={add.isPending}
              >
                <Plus className="size-4" />
                הוסף
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDelete
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing)}
        pending={remove.isPending}
        title={`מחיקת השדה "${removing?.label ?? ''}"`}
        phrase={removing?.label ?? ''}
        phraseLabel="שם השדה"
      >
        <p>
          מחיקת השדה תמחק גם את הערך שלו אצל כל הלקוחות. הערכים האלה אינם ניתנים
          לשחזור, וגם ייבוא חוזר של הקובץ המקורי לא יחזיר אותם ללקוחות שכבר קיימים.
        </p>
        <p>שאר פרטי הלקוחות לא ייפגעו.</p>
      </ConfirmDelete>
    </>
  )
}

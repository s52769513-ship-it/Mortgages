import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mic, Square, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'
import { AVAILABILITY, CLIENT_PRIORITY, CONTACT_METHOD, LEAD_STATUS, options } from '@/lib/labels'
import { useVoiceRecorder, type Recording } from '@/lib/useVoiceRecorder'
import type { Client } from '@/types'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

const BLANK = {
  fullName: '',
  phone: '',
  email: '',
  partnerName: '',
  partnerPhone: '',
  leadStatus: 'NEW',
  referralSource: '',
  preferredContact: 'PHONE',
  availEmail: '',
  availWhatsapp: '',
  availPhone: '',
  declaredIncome: '',
  declaredAssets: '',
  declaredLiabilities: '',
  targetDate: '',
  agreedFee: '',
  priorities: [] as string[],
  prioritiesNote: '',
  doNotContact: false,
  introNotes: '',
}

const CHANNELS = [
  { key: 'availPhone', label: 'שיחות טלפון' },
  { key: 'availWhatsapp', label: 'וואטסאפ' },
  { key: 'availEmail', label: 'אימייל' },
] as const

const duration = (ms: number) => {
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-hair pt-5 first:border-0 first:pt-0">
      <div>
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {hint && <p className="mt-0.5 text-[12.5px] text-ink-subtle">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * The first conversation with a lead, on one screen.
 *
 * Everything the client says about their money is recorded as a statement,
 * not as fact — the wording says so, and the file is where those numbers get
 * checked against documents later. Grouped into sections because a flat list
 * of twenty fields is not something anyone fills in while on the phone.
 */
export function NewLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notify } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(BLANK)
  const [story, setStory] = useState<Recording | null>(null)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const recorder = useVoiceRecorder(setStory)

  useEffect(() => {
    if (recorder.denied) {
      notify('אין גישה למיקרופון', {
        tone: 'error',
        detail: 'צריך לאשר לדפדפן להשתמש במיקרופון כדי להקליט.',
      })
    }
  }, [recorder.denied, notify])

  const togglePriority = (value: string) =>
    set(
      'priorities',
      form.priorities.includes(value)
        ? form.priorities.filter((p) => p !== value)
        : [...form.priorities, value],
    )

  const create = useMutation({
    mutationFn: async () => {
      const client = await api.post<Client>('/clients', {
        ...form,
        email: form.email.trim() || null,
        partnerName: form.partnerName.trim() || null,
        partnerPhone: form.partnerPhone.trim() || null,
        referralSource: form.referralSource.trim() || null,
        declaredIncome: form.declaredIncome || null,
        declaredAssets: form.declaredAssets.trim() || null,
        declaredLiabilities: form.declaredLiabilities.trim() || null,
        targetDate: form.targetDate || null,
        agreedFee: form.agreedFee || null,
        prioritiesNote: form.prioritiesNote.trim() || null,
        introNotes: form.introNotes.trim() || null,
        availEmail: form.availEmail || null,
        availWhatsapp: form.availWhatsapp || null,
        availPhone: form.availPhone || null,
      })

      // The recording goes onto the client's own chat, where anyone with
      // access to the card can play it.
      if (story) {
        const body = new FormData()
        body.append('body', 'סיפור הלקוח — הוקלט בשיחת ההיכרות')
        body.append('file', story.file, story.file.name)
        body.append('kind', 'VOICE')
        body.append('durationMs', String(story.durationMs))
        await api.upload(`/comments/CLIENT/${client.id}`, body)
      }

      return client
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify('הליד נוצר', {
        detail: client.fullName,
        action: { label: 'פתח את הכרטיס', onClick: () => navigate(`/clients/${client.id}`) },
      })
      setForm(BLANK)
      setStory(null)
      onClose()
    },
    onError: (e: Error) => notify('יצירת הליד נכשלה', { tone: 'error', detail: e.message }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ליד חדש"
      description="מה שנאסף בשיחה הראשונה. תיק משכנתא נפתח אחר כך מתוך כרטיס הלקוח."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="new-lead" type="submit" loading={create.isPending}>
            שמור ליד
          </Button>
        </>
      }
    >
      <form id="new-lead" onSubmit={submit} className="space-y-6">
        <Section title="הלווים">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="שם מלא"
              required
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
            />
            <Input
              label="טלפון"
              required
              dir="ltr"
              className="numeric"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
            <Input
              label="שם הלווה השני"
              hint="אם המשכנתא נלקחת בזוג"
              value={form.partnerName}
              onChange={(e) => set('partnerName', e.target.value)}
            />
            <Input
              label="טלפון הלווה השני"
              dir="ltr"
              className="numeric"
              value={form.partnerPhone}
              onChange={(e) => set('partnerPhone', e.target.value)}
            />
            <Input
              label="אימייל"
              type="email"
              dir="ltr"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
            <Input
              label="מקור הפנייה"
              value={form.referralSource}
              onChange={(e) => set('referralSource', e.target.value)}
            />
          </div>
        </Section>

        <Section
          title="התמונה הפיננסית — לפי הצהרת הלקוח"
          hint="מה שנמסר בשיחה. אף פרט כאן לא אומת מול מסמכים; האימות נעשה בתיק."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="הכנסות חודשיות"
              type="number"
              dir="ltr"
              className="numeric"
              value={form.declaredIncome}
              onChange={(e) => set('declaredIncome', e.target.value)}
            />
            <Input
              label="תאריך ביצוע משוער"
              type="date"
              dir="ltr"
              hint="בערך, כפי שנמסר"
              value={form.targetDate}
              onChange={(e) => set('targetDate', e.target.value)}
            />
          </div>
          <Textarea
            label="נכסים"
            rows={2}
            hint="דירה, חסכונות, רכב — כפי שתוארו"
            value={form.declaredAssets}
            onChange={(e) => set('declaredAssets', e.target.value)}
          />
          <Textarea
            label="התחייבויות"
            rows={2}
            hint="הלוואות קיימות, משכנתא קודמת, אשראי"
            value={form.declaredLiabilities}
            onChange={(e) => set('declaredLiabilities', e.target.value)}
          />
        </Section>

        <Section title="מה חשוב ללקוח" hint="אפשר לסמן יותר מאחד.">
          <div className="flex flex-wrap gap-2">
            {options(CLIENT_PRIORITY).map((option) => {
              const picked = form.priorities.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => togglePriority(option.value)}
                  aria-pressed={picked}
                  className={cn(
                    'rounded-md border px-3.5 py-2 text-[14px] transition-colors duration-micro',
                    picked
                      ? 'border-steel-600 bg-steel-100 font-medium text-steel-800'
                      : 'border-field text-ink-muted hover:border-steel-600 hover:text-ink',
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {form.priorities.includes('OTHER') && (
            <Input
              label="פירוט"
              value={form.prioritiesNote}
              onChange={(e) => set('prioritiesNote', e.target.value)}
            />
          )}
        </Section>

        <Section title="איך ומתי ליצור קשר" hint="ערוץ שלא נבחרה בו זמינות לא ישמש לפנייה.">
          <div className="grid gap-4 sm:grid-cols-3">
            {CHANNELS.map((channel) => (
              <Select
                key={channel.key}
                label={channel.label}
                options={[{ value: '', label: 'לא מועדף' }, ...options(AVAILABILITY)]}
                value={form[channel.key]}
                onChange={(e) => set(channel.key, e.target.value)}
              />
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label="ערוץ עיקרי"
              options={options(CONTACT_METHOD)}
              value={form.preferredContact}
              onChange={(e) => set('preferredContact', e.target.value)}
            />
            <Select
              label="סטטוס ליד"
              options={options(LEAD_STATUS)}
              value={form.leadStatus}
              onChange={(e) => set('leadStatus', e.target.value)}
            />
          </div>
          <Checkbox
            label="לא לשלוח הודעות ללקוח זה"
            checked={form.doNotContact}
            onChange={(e) => set('doNotContact', e.target.checked)}
          />
        </Section>

        <Section title="העסקה והשכר" hint="מה שסוכם על שכר הטרחה בשיחה.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="שכר טרחה שסוכם"
              type="number"
              dir="ltr"
              className="numeric"
              value={form.agreedFee}
              onChange={(e) => set('agreedFee', e.target.value)}
            />
          </div>
        </Section>

        <Section
          title="סיפור הלקוח"
          hint="הקלטה קצרה של מה שסופר בשיחה. תישמר בכרטיס הלקוח וכל מי שיש לו גישה יוכל להאזין."
        >
          {recorder.recording ? (
            <div className="flex items-center gap-3 rounded-lg bg-urgent-tint px-3 py-2.5">
              <span className="size-2.5 animate-pulse rounded-full bg-urgent" aria-hidden />
              <span className="numeric flex-1 text-[14px] font-medium text-urgent-ink" dir="ltr">
                {duration(recorder.elapsed)}
              </span>
              <Button size="sm" variant="secondary" onClick={recorder.cancel}>
                בטל
              </Button>
              <Button size="sm" onClick={recorder.stop}>
                <Square className="size-3.5 fill-current" />
                סיים הקלטה
              </Button>
            </div>
          ) : story ? (
            <div className="flex items-center gap-3 rounded-lg border border-field px-3 py-2.5">
              <Mic className="size-4 shrink-0 text-ok" aria-hidden />
              <span className="flex-1 text-[14px]">
                הוקלט{' '}
                <span className="numeric text-ink-muted" dir="ltr">
                  {duration(story.durationMs)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setStory(null)}
                aria-label="מחיקת ההקלטה"
                className="rounded p-1 text-ink-subtle transition-colors duration-micro hover:text-urgent"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={recorder.start}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md border border-dashed',
                'border-field px-3 py-4 text-[14px] text-ink-muted',
                'transition-colors duration-micro ease-standard hover:border-steel-600 hover:text-ink',
              )}
            >
              <Mic className="size-4" />
              הקלט את סיפור הלקוח
            </button>
          )}
        </Section>

        <Section title="הערות">
          <Textarea
            label="הערות משיחת ההיכרות"
            rows={3}
            value={form.introNotes}
            onChange={(e) => set('introNotes', e.target.value)}
          />
        </Section>
      </form>
    </Modal>
  )
}

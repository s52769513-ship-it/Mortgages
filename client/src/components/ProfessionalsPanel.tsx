import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Pencil, Phone, Plus, UserPlus, X } from 'lucide-react'
import { api, qs } from '@/api/client'
import { labelOf, options, PROFESSIONAL_ROLE } from '@/lib/labels'
import type { FileProfessional, Professional } from '@/types'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

function AttachModal({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const { notify } = useToast()
  const queryClient = useQueryClient()

  const [role, setRole] = useState('CLIENT_LAWYER')
  const [picked, setPicked] = useState<{ id: string | null; text: string }>({ id: null, text: '' })
  const [details, setDetails] = useState({ phone: '', email: '', organization: '', notes: '' })
  const [touched, setTouched] = useState(false)

  const attach = useMutation({
    mutationFn: () =>
      api.post<FileProfessional>(`/professionals/files/${fileId}`, {
        roleInFile: role,
        // An existing contact is reused; anything else is created from what was typed.
        ...(picked.id
          ? { professionalId: picked.id }
          : {
              create: {
                role,
                name: picked.text.trim(),
                phone: details.phone.trim() || null,
                email: details.email.trim() || null,
                organization: details.organization.trim() || null,
                notes: details.notes.trim() || null,
              },
            }),
      }),
    onSuccess: (link) => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] })
      queryClient.invalidateQueries({ queryKey: ['professionals'] })
      notify('איש המקצוע שויך לתיק', { detail: link.professional.name })
      onClose()
    },
    onError: (e: Error) => notify('השיוך נכשל', { tone: 'error', detail: e.message }),
  })

  const missingName = picked.text.trim().length < 2
  const isNew = !picked.id && picked.text.trim().length >= 2

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (missingName) return
    attach.mutate()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="שיוך איש מקצוע"
      description="בחר מתוך ספר הקשרים של המשרד, או הקלד שם חדש והוא יישמר לפעם הבאה."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="attach-professional" type="submit" loading={attach.isPending}>
            שייך לתיק
          </Button>
        </>
      }
    >
      <form id="attach-professional" onSubmit={submit} className="space-y-5">
        <Select
          label="תפקיד בתיק"
          options={options(PROFESSIONAL_ROLE)}
          value={role}
          onChange={(e) => {
            setRole(e.target.value)
            setPicked({ id: null, text: '' })
          }}
        />

        <Combobox
          label="שם"
          required
          endpoint={`/professionals${qs({ role })}`}
          placeholder="הקלד שם או בחר מהרשימה…"
          value={picked}
          onChange={setPicked}
          error={touched && missingName ? 'נדרש שם' : undefined}
          hint={isNew ? 'לא נמצא ברשימה — ייווצר כאיש קשר חדש.' : undefined}
        />

        {isNew && (
          <div className="animate-fade-in space-y-5 border-t border-hair pt-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="טלפון"
                dir="ltr"
                className="numeric"
                value={details.phone}
                onChange={(e) => setDetails({ ...details, phone: e.target.value })}
              />
              <Input
                label="אימייל"
                type="email"
                dir="ltr"
                value={details.email}
                onChange={(e) => setDetails({ ...details, email: e.target.value })}
              />
            </div>
            <Input
              label="משרד או ארגון"
              value={details.organization}
              onChange={(e) => setDetails({ ...details, organization: e.target.value })}
            />
            <Textarea
              label="הערות"
              rows={2}
              value={details.notes}
              onChange={(e) => setDetails({ ...details, notes: e.target.value })}
            />
          </div>
        )}
      </form>
    </Modal>
  )
}

/**
 * Corrects a contact already on the file. The details belong to the person and
 * follow them to every file; the role belongs to this link alone, so changing
 * it re-links rather than editing the person.
 */
function EditModal({
  fileId,
  link,
  onClose,
}: {
  fileId: string
  link: FileProfessional
  onClose: () => void
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()

  const [role, setRole] = useState(link.roleInFile)
  const [form, setForm] = useState({
    name: link.professional.name,
    phone: link.professional.phone ?? '',
    email: link.professional.email ?? '',
    organization: link.professional.organization ?? '',
    notes: link.professional.notes ?? '',
  })
  const [touched, setTouched] = useState(false)

  const save = useMutation({
    mutationFn: async () => {
      await api.patch<Professional>(`/professionals/${link.professionalId}`, {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        organization: form.organization.trim() || null,
        notes: form.notes.trim() || null,
      })

      if (role !== link.roleInFile) {
        // Attach under the new role before removing the old one, so the person
        // is never briefly off the file.
        await api.post<FileProfessional>(`/professionals/files/${fileId}`, {
          professionalId: link.professionalId,
          roleInFile: role,
        })
        await api.delete<void>(
          `/professionals/files/${fileId}/${link.professionalId}/${link.roleInFile}`,
        )
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] })
      queryClient.invalidateQueries({ queryKey: ['professionals'] })
      notify('הפרטים עודכנו', { detail: form.name.trim() })
      onClose()
    },
    onError: (e: Error) => notify('העדכון נכשל', { tone: 'error', detail: e.message }),
  })

  const missingName = form.name.trim().length < 2

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (missingName) return
    save.mutate()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="פרטי איש המקצוע"
      description="הפרטים מתעדכנים בכל התיקים שבהם הוא מופיע."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            בטל
          </Button>
          <Button form="edit-professional" type="submit" loading={save.isPending}>
            שמור שינויים
          </Button>
        </>
      }
    >
      <form id="edit-professional" onSubmit={submit} className="space-y-5">
        <Select
          label="תפקיד בתיק"
          options={options(PROFESSIONAL_ROLE)}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />

        <Input
          label="שם"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={touched && missingName ? 'נדרש שם' : undefined}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="טלפון"
            dir="ltr"
            className="numeric"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="אימייל"
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <Input
          label="משרד או ארגון"
          value={form.organization}
          onChange={(e) => setForm({ ...form, organization: e.target.value })}
        />

        <Textarea
          label="הערות"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </form>
    </Modal>
  )
}

/** The people around a file who do not work at the office. */
export function ProfessionalsPanel({
  fileId,
  professionals,
}: {
  fileId: string
  professionals: FileProfessional[]
}) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [attaching, setAttaching] = useState(false)
  const [editing, setEditing] = useState<FileProfessional | null>(null)

  const detach = useMutation({
    mutationFn: (link: FileProfessional) =>
      api.delete<void>(`/professionals/files/${fileId}/${link.professionalId}/${link.roleInFile}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] })
      notify('השיוך בוטל')
    },
    onError: (e: Error) => notify('הפעולה נכשלה', { tone: 'error', detail: e.message }),
  })

  return (
    <section className="border-t border-hair pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="eyebrow text-[12px] text-ink-muted" dir="ltr">
          People
        </h3>
        <button
          onClick={() => setAttaching(true)}
          aria-label="שיוך איש מקצוע"
          className="rounded p-1 text-ink-subtle transition-colors duration-micro hover:bg-ink/[0.06] hover:text-ink"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {!professionals.length ? (
        <button
          onClick={() => setAttaching(true)}
          className="flex w-full items-center gap-2 rounded-md border border-dashed border-field px-3 py-3 text-[13px] text-ink-muted transition-colors duration-micro hover:border-steel-600 hover:text-ink"
        >
          <UserPlus className="size-4" />
          שייך עו״ד, שמאי או גורם אחר
        </button>
      ) : (
        <ul className="space-y-2.5">
          {professionals.map((link) => (
            <li key={`${link.professionalId}-${link.roleInFile}`} className="group">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12.5px] text-ink-subtle">
                    {labelOf(PROFESSIONAL_ROLE, link.roleInFile).label}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditing(link)}
                    className="block max-w-full truncate text-start text-[14px] font-medium text-ink transition-colors duration-micro hover:text-steel-700 hover:underline"
                  >
                    {link.professional.name}
                  </button>
                  <div className="mt-0.5 flex flex-wrap gap-3 text-[12.5px] text-ink-muted">
                    {link.professional.phone && (
                      <a
                        href={`tel:${link.professional.phone}`}
                        className="numeric flex items-center gap-1 hover:text-ink"
                        dir="ltr"
                      >
                        <Phone className="size-3" />
                        {link.professional.phone}
                      </a>
                    )}
                    {link.professional.email && (
                      <a
                        href={`mailto:${link.professional.email}`}
                        className="flex items-center gap-1 truncate hover:text-ink"
                        dir="ltr"
                      >
                        <Mail className="size-3" />
                        {link.professional.email}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-micro group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    onClick={() => setEditing(link)}
                    aria-label={`עריכת ${link.professional.name}`}
                    className="rounded p-1 text-ink-subtle transition-colors duration-micro hover:text-ink"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => detach.mutate(link)}
                    aria-label={`ביטול שיוך ${link.professional.name}`}
                    className="rounded p-1 text-ink-subtle transition-colors duration-micro hover:text-urgent"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {attaching && <AttachModal fileId={fileId} onClose={() => setAttaching(false)} />}

      {editing && (
        <EditModal
          key={`${editing.professionalId}-${editing.roleInFile}`}
          fileId={fileId}
          link={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}

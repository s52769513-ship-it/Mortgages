import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Mail, MoreHorizontal, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'
import { date, initials, money, relative } from '@/lib/format'
import { AVAILABILITY, CLIENT_PRIORITY, CONTACT_METHOD, FILE_STAGE, FILE_STATUS, labelOf, LEAD_STATUS } from '@/lib/labels'
import type { Client } from '@/types'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, RAILS } from '@/components/ui/Badge'
import { FactRow, Tabs, TabPanel } from '@/components/ui/Tabs'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { InternalChat } from '@/components/InternalChat'
import { ActivityFeed } from '@/components/ActivityFeed'
import { EditClientModal } from '@/components/EditClientModal'
import { NewFileModal } from '@/components/NewFileModal'
import { Button } from '@/components/ui/Button'
import { Menu, MenuItem } from '@/components/ui/Menu'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDelete } from '@/components/ConfirmDelete'

export function ClientDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [tab, setTab] = useState('chat')
  const [editing, setEditing] = useState(false)
  const [openingFile, setOpeningFile] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const {
    data: client,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get<Client>(`/clients/${id}`),
  })

  // The files go with the client, so the request says so out loud — the server
  // refuses a client who still has files unless it is asked in those terms.
  const removeClient = useMutation({
    mutationFn: () => api.delete(`/clients/${id}?withFiles=1`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify('הלקוח נמחק')
      navigate('/clients')
    },
    onError: (e: Error) => notify('מחיקת הלקוח נכשלה', { tone: 'error', detail: e.message }),
  })

  if (error) return <ErrorState message="לא הצלחנו לטעון את הלקוח." onRetry={() => refetch()} />

  if (isLoading || !client) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    )
  }

  // Only the channels the client actually offered, each with when to use it.
  const files = client.files ?? []

  const channels = [
    { value: client.availPhone, label: 'שיחות' },
    { value: client.availWhatsapp, label: 'וואטסאפ' },
    { value: client.availEmail, label: 'אימייל' },
  ]
    .filter((c) => c.value)
    .map((c) => `${c.label}: ${labelOf(AVAILABILITY, c.value!).label}`)

  return (
    <div className="space-y-6">
      <div>
        <nav className="mb-2 text-[13px] text-ink-subtle">
          <Link to="/clients" className="hover:text-ink-muted">
            לקוחות ולידים
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-ink-muted">{client.fullName}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-steel-600 text-[18px] font-bold text-white">
              {initials(client.fullName)}
            </span>
            <div className="min-w-0">
              <h1 className="font-heading text-[32px] font-bold leading-tight text-ink">
                {client.fullName}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-5 text-[14px] text-ink-muted">
                <span className="flex items-center gap-1.5" dir="ltr">
                  <Phone className="size-3.5" />
                  <span className="numeric">{client.phone}</span>
                </span>
                {client.email && (
                  <span className="flex items-center gap-1.5" dir="ltr">
                    <Mail className="size-3.5" />
                    {client.email}
                  </span>
                )}
              </div>
              {/* Quick client stats. */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                <span className="text-ink-subtle">
                  תיקים:{' '}
                  <span className="numeric font-medium text-ink">{client.files?.length ?? 0}</span>
                </span>
                <span className="text-ink-subtle">
                  סכום מבוקש כולל:{' '}
                  <span className="numeric font-medium text-ink" dir="ltr">
                    {money(
                      client.files
                        ?.reduce(
                          (sum, f) => sum + (f.requestedAmount ? parseFloat(f.requestedAmount) : 0),
                          0,
                        )
                        .toString() ?? '0',
                    )}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={labelOf(LEAD_STATUS, client.leadStatus).tone} dot>
              {labelOf(LEAD_STATUS, client.leadStatus).label}
            </Badge>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              ערוך
            </Button>
            <Button onClick={() => setOpeningFile(true)}>
              <Plus className="size-4" />
              פתח תיק
            </Button>

            {/* Out of the way of the everyday actions on purpose. */}
            <Menu
              label={`פעולות נוספות ללקוח ${client.fullName}`}
              align="end"
              width={210}
              className="shrink-0"
              trigger={({ open }) => (
                <span
                  className={cn(
                    'flex size-11 items-center justify-center rounded-md border border-field text-ink-muted md:size-9',
                    'transition-colors duration-micro ease-standard hover:bg-ink/[0.04] hover:text-ink',
                    open && 'bg-ink/[0.06] text-ink',
                  )}
                >
                  <MoreHorizontal className="size-4" />
                </span>
              )}
            >
              {(close) => (
                <MenuItem
                  tone="danger"
                  onClick={() => {
                    close()
                    setDeleting(true)
                  }}
                >
                  <Trash2 className="size-4" />
                  מחק לקוח
                </MenuItem>
              )}
            </Menu>
          </div>
        </div>
      </div>

      {client.doNotContact && (
        <div className="border-s-[5px] border-s-urgent bg-urgent-tint px-4 py-3 text-[14px] text-urgent-ink">
          הלקוח ביקש לא לקבל הודעות — אין לשלוח מיילים או מסרונים.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader title="פרטי הלקוח" />
            <dl className="divide-y divide-row px-6 py-2">
              <FactRow label="מקור הפנייה" value={client.referralSource} />
              <FactRow
                label="תאריך פנייה"
                value={<span className="numeric" dir="ltr">{date(client.referralDate)}</span>}
              />
              <FactRow label="סוג הפנייה" value={client.inquiryType} />
              <FactRow
                label="דרך תקשורת מועדפת"
                value={labelOf(CONTACT_METHOD, client.preferredContact).label}
              />
              <FactRow label="איש קשר מטעם המשרד" value={client.owner?.name} />
              {client.partnerName && (
                <FactRow
                  label="לווה שני"
                  value={
                    <>
                      {client.partnerName}
                      {client.partnerPhone && (
                        <span className="numeric text-ink-muted" dir="ltr">
                          {' · '}
                          {client.partnerPhone}
                        </span>
                      )}
                    </>
                  }
                />
              )}
              {channels.length > 0 && (
                <FactRow label="זמינות" value={channels.join(' · ')} />
              )}
              {client.priorities?.length > 0 && (
                <FactRow
                  label="חשוב ללקוח"
                  value={
                    client.priorities
                      .map((p) => labelOf(CLIENT_PRIORITY, p).label)
                      .join(' · ') + (client.prioritiesNote ? ` — ${client.prioritiesNote}` : '')
                  }
                />
              )}
              {client.agreedFee && (
                <FactRow
                  label="שכר טרחה שסוכם"
                  value={<span className="numeric" dir="ltr">{money(client.agreedFee)}</span>}
                />
              )}
              {client.targetDate && (
                <FactRow
                  label="תאריך ביצוע משוער"
                  value={<span className="numeric" dir="ltr">{date(client.targetDate)}</span>}
                />
              )}
              <FactRow
                label="נוצר"
                value={<span className="numeric" dir="ltr">{date(client.createdAt)}</span>}
              />
            </dl>

            {/* What the client told us before anything was checked. Kept apart
                from the verified figures on the file, and labelled as such. */}
            {(client.declaredIncome || client.declaredAssets || client.declaredLiabilities) && (
              <div className="border-t border-hair px-6 py-5">
                <p className="mb-3 text-[12px] font-semibold text-ink-muted">
                  לפי הצהרת הלקוח · טרם אומת מול מסמכים
                </p>
                <dl className="space-y-2.5 text-[14px]">
                  {client.declaredIncome && (
                    <div className="flex gap-2">
                      <dt className="text-ink-subtle">הכנסות חודשיות:</dt>
                      <dd className="numeric font-medium" dir="ltr">
                        {money(client.declaredIncome)}
                      </dd>
                    </div>
                  )}
                  {client.declaredAssets && (
                    <div>
                      <dt className="text-ink-subtle">נכסים:</dt>
                      <dd className="whitespace-pre-wrap text-ink-muted">{client.declaredAssets}</dd>
                    </div>
                  )}
                  {client.declaredLiabilities && (
                    <div>
                      <dt className="text-ink-subtle">התחייבויות:</dt>
                      <dd className="whitespace-pre-wrap text-ink-muted">
                        {client.declaredLiabilities}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
            {client.introNotes && (
              <div className="border-t border-hair px-6 py-5">
                <p className="mb-2 text-[12px] font-semibold text-ink-muted">
                  הערות משיחת ההיכרות
                </p>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-muted">
                  {client.introNotes}
                </p>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="תיקי משכנתא"
              subtitle={`${client.files?.length ?? 0} תיקים ללקוח זה`}
              action={
                <Button size="sm" variant="secondary" onClick={() => setOpeningFile(true)}>
                  <Plus className="size-4" />
                  תיק חדש
                </Button>
              }
            />
            {!client.files?.length ? (
              <EmptyState
                icon={<FolderOpen className="size-7" />}
                title="אין תיקים ללקוח זה"
                description="תיק מרכז את כל מה שקשור לעסקה אחת. אותו לקוח יכול להחזיק כמה תיקים במקביל."
                action={<Button onClick={() => setOpeningFile(true)}>פתח תיק ראשון</Button>}
              />
            ) : (
              <ul>
                {client.files.map((file, i) => (
                  <li key={file.id}>
                    <Link
                      to={`/files/${file.id}`}
                      className={cn(
                        'flex items-center gap-4 border-s-4 px-6 py-4',
                        'transition-colors duration-micro ease-standard hover:bg-ink/[0.04]',
                        i < client.files!.length - 1 && 'border-b border-b-row',
                        RAILS[labelOf(FILE_STATUS, file.status).tone],
                      )}
                    >
                      <span
                        className="numeric w-24 shrink-0 text-[14px] font-semibold text-steel-700"
                        dir="ltr"
                      >
                        {file.fileNumber}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink-muted">
                        {file.propertyAddress || 'ללא כתובת נכס'}
                      </span>
                      <span
                        className="numeric hidden shrink-0 text-[14px] text-ink-muted sm:block"
                        dir="ltr"
                      >
                        {money(file.requestedAmount)}
                      </span>
                      <Badge tone={labelOf(FILE_STAGE, file.stage).tone}>
                        {labelOf(FILE_STAGE, file.stage).label}
                      </Badge>
                      <span className="hidden w-20 shrink-0 text-[13px] text-ink-subtle md:block">
                        {relative(file.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="flex h-[640px] flex-col overflow-hidden xl:sticky xl:top-[88px]">
          <Tabs
            tabs={[
              { id: 'chat', label: 'צ׳אט פנימי' },
              { id: 'log', label: 'יומן פעילות' },
            ]}
            active={tab}
            onChange={setTab}
            className="!px-4"
          />
          <div className="flex min-h-0 flex-1 flex-col">
            <TabPanel when="chat" active={tab} className="flex min-h-0 flex-1 flex-col">
              <InternalChat entityType="CLIENT" entityId={client.id} className="min-h-0 flex-1" />
            </TabPanel>
            <TabPanel when="log" active={tab} className="min-h-0 flex-1 overflow-y-auto">
              <ActivityFeed entityType="CLIENT" entityId={client.id} />
            </TabPanel>
          </div>
        </Card>
      </div>

      {editing && <EditClientModal client={client} open onClose={() => setEditing(false)} />}
      {openingFile && (
        <NewFileModal
          open
          client={{ id: client.id, fullName: client.fullName }}
          onClose={() => setOpeningFile(false)}
        />
      )}

      <ConfirmDelete
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => removeClient.mutate()}
        pending={removeClient.isPending}
        title={`מחיקת הלקוח ${client.fullName}`}
        phrase={client.fullName}
        phraseLabel="שם הלקוח המלא"
      >
        {files.length > 0 ? (
          <>
            <p>
              ללקוח {files.length === 1 ? 'תיק משכנתא אחד' : `${files.length} תיקי משכנתא`}.
              מחיקת הלקוח תמחק גם אותם, ואיתם המשימות, המסמכים והקבצים שהועלו,
              הבקשות לבנקים, רישומי התקשורת, ההוצאות וכל שיחת הצוות.
            </p>
            <ul className="space-y-1 text-[13.5px] text-ink-muted">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-2">
                  <span className="numeric shrink-0" dir="ltr">
                    {f.fileNumber}
                  </span>
                  <span className="truncate">{labelOf(FILE_STAGE, f.stage).label}</span>
                </li>
              ))}
            </ul>
            <p>אם המטרה היא רק לסגור טיפול — עדיף לשנות את סטטוס הליד.</p>
          </>
        ) : (
          <p>
            הלקוח יימחק על כל פרטיו, כולל שיחת הצוות עליו וההקלטות שצורפו לה.
            אין לו תיקי משכנתא, כך שלא יימחק דבר נוסף.
          </p>
        )}
      </ConfirmDelete>
    </div>
  )
}

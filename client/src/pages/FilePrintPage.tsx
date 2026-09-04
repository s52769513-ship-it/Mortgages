import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { api } from '@/api/client'
import { date, money, percent } from '@/lib/format'
import {
  BANK_APP_STATUS,
  DOCUMENT_STATUS,
  FILE_STAGE,
  FILE_STATUS,
  labelOf,
  PROFESSIONAL_ROLE,
  URGENCY,
} from '@/lib/labels'
import type { MortgageFile } from '@/types'
import { ErrorState, Skeleton } from '@/components/ui/States'

/**
 * The file on paper. Rendered by the browser rather than generated, so Hebrew
 * comes out exactly as it does on screen and the agent can save it as a PDF
 * from the same dialog that prints it.
 */
export function FilePrintPage() {
  const { id = '' } = useParams()

  const { data: file, isLoading, error, refetch } = useQuery({
    queryKey: ['file', id],
    queryFn: () => api.get<MortgageFile>(`/files/${id}`),
  })

  // Opened for one purpose; offer the dialog as soon as there is something
  // to print rather than making the agent hunt for it.
  useEffect(() => {
    if (!file) return
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [file])

  if (error) return <ErrorState message="לא הצלחנו לטעון את התיק." onRetry={() => refetch()} />
  if (isLoading || !file) return <Skeleton className="m-10 h-96" />

  const documents = file.documents ?? []
  const marked = documents.filter((doc) => doc.allowedForBank)
  const forBank = marked.length ? marked : documents

  return (
    <div className="mx-auto max-w-[820px] bg-white p-10 text-ink print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <p className="text-[13px] text-ink-muted">
          תצוגת הדפסה. בחלון ההדפסה אפשר גם לשמור כ-PDF.
        </p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-md bg-steel-700 px-4 py-2 text-[14px] font-medium text-white"
        >
          <Printer className="size-4" />
          הדפס
        </button>
      </div>

      <header className="border-b-2 border-ink pb-3">
        <h1 className="font-heading text-[24px] font-semibold">
          תיק משכנתא <span dir="ltr">{file.fileNumber}</span>
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          {file.client?.fullName}
          {file.owner && ` · ${file.owner.name}`} · הופק {date(new Date())}
        </p>
      </header>

      <Section title="הלקוח">
        <Fact label="שם" value={file.client?.fullName} />
        <Fact label="טלפון" value={file.client?.phone} ltr />
        <Fact label="אימייל" value={file.client?.email} ltr />
        <Fact label="אחראי מוביל" value={file.owner?.name} />
      </Section>

      <Section title="העסקה">
        <Fact label="סוג עסקה" value={file.dealType} />
        <Fact label="סוג נכס" value={file.propertyType} />
        <Fact label="כתובת הנכס" value={file.propertyAddress} />
        <Fact label="מחיר רכישה" value={money(file.purchasePrice)} />
        <Fact label="שווי הנכס" value={money(file.propertyValue)} />
        <Fact label="שלב" value={labelOf(FILE_STAGE, file.stage).label} />
        <Fact label="מצב התיק" value={labelOf(FILE_STATUS, file.status).label} />
        <Fact label="דחיפות" value={labelOf(URGENCY, file.urgency).label} />
      </Section>

      <Section title="המימון">
        <Fact label="סכום מבוקש" value={money(file.requestedAmount)} />
        <Fact label="אחוז מימון" value={percent(file.ltvPercent)} />
        <Fact label="הון עצמי" value={money(file.equity)} />
        <Fact label="החזר חודשי רצוי" value={money(file.desiredMonthly)} />
        <Fact label="הכנסה נדרשת" value={money(file.requiredIncome)} />
        <Fact label="הכנסות הלווים" value={money(file.borrowersIncome)} />
        <Fact label="תאריך תשלום קרוב" value={date(file.nextPaymentDate)} />
        <Fact label="מועד אחרון לביצוע" value={date(file.executionDeadline)} />
      </Section>

      {file.existingLiabilities && (
        <p className="mt-2 text-[13px] text-ink-muted">
          התחייבויות קיימות: {file.existingLiabilities}
        </p>
      )}

      {file.bankApps?.length ? (
        <Table
          title="בקשות לבנקים"
          headers={['בנק', 'סניף', 'סטטוס', 'סכום', 'מימון', 'תוקף אישור']}
          rows={file.bankApps.map((app) => [
            `${app.isChosen ? '★ ' : ''}${app.bank?.name ?? '—'}`,
            app.branch?.name ?? '—',
            labelOf(BANK_APP_STATUS, app.status).label,
            money(app.requestedAmount),
            percent(app.ltvPercent),
            app.approvalValidUntil ? date(app.approvalValidUntil) : '—',
          ])}
        />
      ) : null}

      {file.professionals?.length ? (
        <Table
          title="אנשי מקצוע"
          headers={['תפקיד', 'שם', 'טלפון', 'ארגון']}
          rows={file.professionals.map((link) => [
            labelOf(PROFESSIONAL_ROLE, link.roleInFile).label,
            link.professional.name,
            link.professional.phone ?? '—',
            link.professional.organization ?? '—',
          ])}
        />
      ) : null}

      {forBank.length ? (
        <Table
          title="המסמכים"
          headers={['#', 'סוג המסמך', 'סטטוס', 'התקבל', 'תוקף']}
          rows={forBank.map((doc) => [
            String(doc.seq),
            doc.docType,
            labelOf(DOCUMENT_STATUS, doc.status).label,
            doc.receivedAt ? date(doc.receivedAt) : '—',
            doc.expiresAt ? date(doc.expiresAt) : '—',
          ])}
        />
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="border-b border-hair pb-1.5 text-[14px] font-semibold">{title}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2">{children}</dl>
    </section>
  )
}

function Fact({ label, value, ltr }: { label: string; value?: string | null; ltr?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 text-[13.5px]">
      <dt className="shrink-0 text-ink-muted">{label}:</dt>
      <dd className="font-medium" dir={ltr ? 'ltr' : undefined}>
        {value?.toString().trim() || '—'}
      </dd>
    </div>
  )
}

function Table({
  title,
  headers,
  rows,
}: {
  title: string
  headers: string[]
  rows: string[][]
}) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="border-b border-hair pb-1.5 text-[14px] font-semibold">{title}</h2>
      <table className="mt-2 w-full text-[13px]">
        <thead>
          <tr className="text-ink-muted">
            {headers.map((header) => (
              <th key={header} className="py-1.5 text-start font-normal">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-row">
              {row.map((cell, j) => (
                <td key={j} className="py-1.5 text-start align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

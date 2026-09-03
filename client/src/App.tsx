import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ClientsPage } from '@/pages/ClientsPage'
import { ClientDetailPage } from '@/pages/ClientDetailPage'
import { FilesPage } from '@/pages/FilesPage'
import { FileDetailPage } from '@/pages/FileDetailPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { Building2, FileText, ListChecks } from 'lucide-react'

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-6 animate-spin text-brand-600" />
    </div>
  )
}

export function App() {
  const { user, ready } = useAuth()

  if (!ready) return <FullPageSpinner />

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="files/:id" element={<FileDetailPage />} />
        <Route
          path="tasks"
          element={
            <PlaceholderPage
              title="משימות"
              icon={<ListChecks className="size-7" />}
              description="רשימת המשימות החוצה־תיקים תיבנה בשלב הבא. בינתיים המשימות של כל תיק מוצגות בדף התיק, ומה שדחוף להיום מופיע בדאשבורד."
            />
          }
        />
        <Route
          path="documents"
          element={
            <PlaceholderPage
              title="מסמכים"
              icon={<FileText className="size-7" />}
              description="מאגר המסמכים החוצה־תיקים ייבנה בשלב הבא. מסמכי כל תיק זמינים בלשונית המסמכים שבדף התיק."
            />
          }
        />
        <Route
          path="bank-applications"
          element={
            <PlaceholderPage
              title="בקשות לבנק"
              icon={<Building2 className="size-7" />}
              description="מסך ההשוואה החוצה־תיקים ייבנה בשלב הבא. השוואת ההצעות לכל תיק זמינה בלשונית הבנקים שבדף התיק."
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

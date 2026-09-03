import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { WelcomeOverlay } from '@/components/WelcomeOverlay'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ClientsPage } from '@/pages/ClientsPage'
import { ClientDetailPage } from '@/pages/ClientDetailPage'
import { FilesPage } from '@/pages/FilesPage'
import { FileDetailPage } from '@/pages/FileDetailPage'
import { TasksPage } from '@/pages/TasksPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { BankApplicationsPage } from '@/pages/BankApplicationsPage'
import { EmployeesPage } from '@/pages/EmployeesPage'

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-6 animate-spin text-brand-600" />
    </div>
  )
}

export function App() {
  const { user, ready, justSignedIn, dismissWelcome } = useAuth()

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
    <>
      {justSignedIn && <WelcomeOverlay name={user.name} onDone={dismissWelcome} />}
      <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="files/:id" element={<FileDetailPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="bank-applications" element={<BankApplicationsPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      </Routes>
    </>
  )
}

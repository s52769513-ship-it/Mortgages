import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell,
  Building2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Search,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'
import { initials } from '@/lib/format'
import { labelOf, ROLE } from '@/lib/labels'
import { Button } from '@/components/ui/Button'

/** Six entries, no more. Settings, staff and banks live in the user menu. */
const NAV = [
  { to: '/', label: 'דאשבורד', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'לקוחות ולידים', icon: Users },
  { to: '/files', label: 'תיקי משכנתא', icon: FolderOpen },
  { to: '/tasks', label: 'משימות', icon: ListChecks },
  { to: '/documents', label: 'מסמכים', icon: FileText },
  { to: '/bank-applications', label: 'בקשות לבנק', icon: Building2 },
  { to: '/employees', label: 'משתמשים', icon: UserCog },
]

function Sidebar({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-steel-900">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10',
          expanded ? 'px-5' : 'justify-center px-2',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-steel-600 text-white">
          <FolderOpen className="size-[18px]" />
        </span>
        {expanded && (
          <span className="eyebrow text-[13px] text-steel-400" dir="ltr">
            Mortgage OS
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            title={expanded ? undefined : label}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md text-[15px]',
                'transition-colors duration-micro ease-standard',
                expanded ? 'px-4 py-2.5' : 'justify-center py-2.5',
                isActive
                  ? 'bg-steel-600 font-medium text-white shadow-button'
                  : 'text-steel-300 hover:bg-white/[0.08] hover:text-white',
              )
            }
          >
            <Icon className="size-[18px] shrink-0" />
            {expanded && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>


    </div>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen">
      {/* 240px rail, collapsed to 64px below 1280px. */}
      <aside className="hidden shrink-0 md:block md:w-16 xl:w-60">
        <div className="fixed inset-y-0 right-0 w-16 xl:w-60">
          <div className="hidden h-full xl:block">
            <Sidebar expanded />
          </div>
          <div className="h-full xl:hidden">
            <Sidebar expanded={false} />
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-steel-900/50 animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-60 animate-overlay-in">
            <Sidebar expanded onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-hair bg-surface/90 px-4 backdrop-blur lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="תפריט"
            className="rounded-md p-2 text-ink-muted transition-colors duration-micro hover:bg-ink/[0.04] hover:text-ink md:hidden"
          >
            <Menu className="size-5" />
          </button>

          <div className="relative hidden min-w-0 max-w-sm flex-1 sm:block">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              placeholder="חיפוש תיק, לקוח או מסמך…"
              className={cn(
                'h-10 w-full rounded-md border border-field bg-surface pe-3 ps-9 text-[15px]',
                'placeholder:text-ink-faint transition-colors duration-micro ease-standard',
                'focus:border-steel-600',
              )}
            />
          </div>

          <div className="ms-auto flex items-center gap-3">
            <Button size="sm" onClick={() => navigate('/files')}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">תיק חדש</span>
            </Button>

            <button
              aria-label="התראות"
              className="rounded-md p-2 text-ink-muted transition-colors duration-micro hover:bg-ink/[0.04] hover:text-ink"
            >
              <Bell className="size-[18px]" />
            </button>

            {user && (
              <div className="flex items-center gap-2.5 border-e border-hair pe-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-steel-600 text-[12px] font-semibold text-white">
                  {initials(user.name)}
                </span>
                <div className="hidden min-w-0 lg:block">
                  <p className="truncate text-[13.5px] font-medium text-ink">{user.name}</p>
                  <p className="truncate text-[12px] text-ink-subtle">
                    {labelOf(ROLE, user.role).label}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  aria-label="התנתקות"
                  className="rounded-md p-1.5 text-ink-subtle transition-colors duration-micro hover:bg-ink/[0.04] hover:text-ink"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* 12-column grid, 24px gutters, capped at 1600px. */}
        <main className="flex-1 px-5 py-6 lg:px-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

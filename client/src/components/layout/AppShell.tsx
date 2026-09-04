import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  Command,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/lib/auth'
import { initials } from '@/lib/format'
import { labelOf, ROLE } from '@/lib/labels'
import { Button } from '@/components/ui/Button'
import { NotificationBell } from '@/components/NotificationBell'
import { GlobalSearch } from '@/components/GlobalSearch'
import { CommandPalette } from '@/components/CommandPalette'

/** Six entries, no more. Settings, staff and banks live in the user menu. */
const NAV = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'לקוחות ולידים', icon: Users },
  { to: '/files', label: 'תיקי משכנתא', icon: FolderOpen },
  { to: '/tasks', label: 'משימות', icon: ListChecks },
  { to: '/documents', label: 'מסמכים', icon: FileText },
  { to: '/bank-applications', label: 'בקשות לבנק', icon: Building2 },
  { to: '/employees', label: 'משתמשים', icon: UserCog },
]

/**
 * The thumb reaches the bottom of a phone, not the top. Four destinations sit
 * there with short labels; the rest open the same drawer the header used to.
 */
const MOBILE_NAV = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard, end: true },
  { to: '/files', label: 'תיקים', icon: FolderOpen },
  { to: '/tasks', label: 'משימות', icon: ListChecks },
  { to: '/clients', label: 'לקוחות', icon: Users },
]

/** The FAB's actions, in the order the office needs them. */
const QUICK_ACTIONS = [
  { to: '/files?new=1', label: 'תיק חדש', icon: FolderOpen },
  { to: '/clients?new=1', label: 'לקוח חדש', icon: UserPlus },
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
        {expanded ? (
          <Logo variant="full" tone="light" height={30} />
        ) : (
          <Logo variant="mark" tone="light" height={32} />
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
                  ? 'border-s-[3px] border-gold bg-steel-600 font-medium text-white shadow-button'
                  : 'border-s-[3px] border-transparent text-steel-300 hover:bg-white/[0.08] hover:text-white',
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
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)

  // The speed dial must not survive the screen it was opened on.
  useEffect(() => {
    setFabOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

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
          <GlobalSearch />

          <div className="ms-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="פקודות מהירות"
              className="hidden items-center gap-2 rounded-md border border-field bg-surface px-3 py-1.5 text-[13px] text-ink-muted transition-colors duration-micro hover:border-steel-600 hover:text-ink sm:flex"
            >
              <Command className="size-3.5" />
              <span>Ctrl+K</span>
            </button>

            <Button
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => navigate('/files?new=1')}
            >
              <Plus className="size-4" />
              תיק חדש
            </Button>

            <NotificationBell />

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

        {/* 12-column grid, 24px gutters, capped at 1600px. The bottom padding
            clears the mobile tab bar; it collapses to nothing from md up. */}
        <main className="flex-1 px-5 py-6 pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-6 lg:px-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ---- mobile only: speed dial + tab bar ---- */}

      {fabOpen && (
        <button
          type="button"
          aria-label="סגירת הפעולות המהירות"
          onClick={() => setFabOpen(false)}
          className="fixed inset-0 z-40 bg-steel-900/40 animate-fade-in md:hidden"
        />
      )}

      <div className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-5 z-50 flex flex-col items-start gap-2.5 md:hidden">
        {fabOpen &&
          QUICK_ACTIONS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setFabOpen(false)}
              className={cn(
                'flex items-center gap-2.5 rounded-full border border-hair bg-surface',
                'py-2.5 pe-4 ps-3 text-[14px] font-medium text-ink shadow-raised animate-overlay-in',
              )}
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-steel-100 text-steel-700">
                <Icon className="size-4" />
              </span>
              {label}
            </Link>
          ))}

        <button
          type="button"
          onClick={() => setFabOpen((v) => !v)}
          aria-expanded={fabOpen}
          aria-label={fabOpen ? 'סגירת הפעולות המהירות' : 'פעולות מהירות'}
          className={cn(
            'flex size-14 items-center justify-center rounded-full bg-steel-600 text-white',
            'shadow-modal transition-transform duration-base ease-standard',
            'active:scale-95',
            fabOpen && 'rotate-45',
          )}
        >
          <Plus className="size-6" />
        </button>
      </div>

      <nav
        aria-label="ניווט ראשי"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-surface/95 backdrop-blur',
          'pb-[env(safe-area-inset-bottom)] md:hidden',
        )}
      >
        <div className="flex items-stretch">
          {MOBILE_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2',
                  'text-[11px] transition-colors duration-micro ease-standard',
                  isActive ? 'font-semibold text-steel-700' : 'text-ink-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-7 w-12 items-center justify-center rounded-full',
                      'transition-colors duration-micro ease-standard',
                      isActive && 'bg-steel-100',
                    )}
                  >
                    <Icon className="size-[19px]" />
                  </span>
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] text-ink-muted"
          >
            <span className="flex h-7 w-12 items-center justify-center">
              <MoreHorizontal className="size-[19px]" />
            </span>
            <span>עוד</span>
          </button>
        </div>
      </nav>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  )
}

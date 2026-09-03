import { useState, type FormEvent } from 'react'
import { FileText } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ההתחברות נכשלה')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm animate-overlay-in">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-steel-600 text-white shadow-raised">
            <FileText className="size-6" />
          </span>
          <h1 className="font-heading text-[26px] font-bold text-ink">ניהול משכנתאות</h1>
          <p className="mt-1 text-[15px] text-ink-muted">התחברות למערכת</p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-5 rounded-lg border border-row bg-surface p-7 shadow-raised"
        >
          <Input
            label="כתובת אימייל"
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="סיסמה"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <div className="border-s-[5px] border-s-urgent bg-urgent-tint px-3 py-2.5 text-[14px] text-urgent-ink">
              {error}
            </div>
          )}

          <Button type="submit" loading={busy} loadingLabel="מתחבר…" className="w-full">
            התחברות
          </Button>
        </form>
      </div>
    </div>
  )
}

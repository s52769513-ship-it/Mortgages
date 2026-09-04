import { useState, type FormEvent } from 'react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Logo } from '@/components/Logo'

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4">
      <BrandBackdrop />

      <div className="relative w-full max-w-md animate-overlay-in">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* The logo is the whole identity of this screen — let it carry it. */}
          <Logo variant="full" className="mb-5 h-16 w-auto sm:h-20" height={80} />
          {/* A short gold rule picks the accent out of the mark. */}
          <span className="mb-3 block h-[3px] w-14 rounded-full bg-gold" />
          <p className="text-[15px] text-ink-muted">התחברות למערכת</p>
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

/**
 * Three soft discs in the brand colours, drifting behind the card. Sizes are
 * in viewport units so the effect holds from a phone to a wide monitor.
 */
function BrandBackdrop() {
  const orbs = [
    { size: '38vmax', top: '-12vmax', right: '-10vmax', color: 'rgb(var(--steel-700) / 0.20)', animation: 'brand-drift-a 26s ease-in-out infinite' },
    { size: '30vmax', bottom: '-10vmax', left: '-8vmax', color: 'rgb(var(--gold) / 0.22)', animation: 'brand-drift-b 32s ease-in-out infinite' },
    { size: '22vmax', top: '30vh', left: '18vw', color: 'rgb(var(--steel-500) / 0.16)', animation: 'brand-drift-c 38s ease-in-out infinite' },
  ]

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {orbs.map((orb, i) => (
        <span
          key={i}
          className="brand-orb"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            bottom: orb.bottom,
            left: orb.left,
            right: orb.right,
            background: orb.color,
            animation: orb.animation,
          }}
        />
      ))}
    </div>
  )
}

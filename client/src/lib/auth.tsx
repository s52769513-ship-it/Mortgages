import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokenStore } from '@/api/client'
import type { User } from '@/types'

type AuthState = {
  user: User | null
  ready: boolean
  /** True only between a successful sign-in and the greeting being dismissed. */
  justSignedIn: boolean
  dismissWelcome: () => void
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [justSignedIn, setJustSignedIn] = useState(false)

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setJustSignedIn(false)
  }, [])

  const dismissWelcome = useCallback(() => setJustSignedIn(false), [])

  // Restore the session from a stored token on first paint.
  useEffect(() => {
    if (!tokenStore.get()) {
      setReady(true)
      return
    }
    api
      .get<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => tokenStore.clear())
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    window.addEventListener('auth:expired', logout)
    return () => window.removeEventListener('auth:expired', logout)
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password })
    tokenStore.set(res.token)
    setUser(res.user)
    setJustSignedIn(true)
  }, [])

  return (
    <AuthContext.Provider value={{ user, ready, justSignedIn, dismissWelcome, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

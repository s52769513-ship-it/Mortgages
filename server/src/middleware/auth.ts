import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'
import { HttpError, sendError } from '../lib/http.js'

export type AuthUser = { id: string; email: string; role: Role; name: string }

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

/** Twelve hours — the JWT and the cookie that carries it expire together. */
const SESSION_SECONDS = 12 * 60 * 60

export const SESSION_COOKIE = 'mortgages_session'

const secret = () => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return s
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, secret(), { expiresIn: SESSION_SECONDS })
}

/**
 * The same token also travels in an HttpOnly cookie, so that a plain link,
 * an <img> or an <audio> element — none of which can carry a header — can
 * still open an uploaded file. Script cannot read the cookie, so a stolen page
 * cannot lift the session out of it the way it could from localStorage.
 */
export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}`
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
}

function tokenFromCookie(req: Request) {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE) return rest.join('=') || undefined
  }
  return undefined
}

/** Routes a read-only account may still write to. */
const VIEWER_WRITABLE = ['/api/notifications', '/api/auth']

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined

  // A mutation must present the header, which a cross-site form cannot forge;
  // the cookie alone is accepted only for reads, which is all a link needs.
  const token = bearer ?? (req.method === 'GET' ? tokenFromCookie(req) : undefined)

  if (!token) return sendError(res, new HttpError(401, 'נדרשת התחברות'))

  let user: AuthUser
  try {
    user = jwt.verify(token, secret()) as AuthUser
  } catch {
    return sendError(res, new HttpError(401, 'ההתחברות פגה, יש להתחבר מחדש'))
  }

  // "View only" has to mean it, on every route, not only the ones that
  // remembered to check.
  const writing = req.method !== 'GET' && req.method !== 'HEAD'
  const exempt = VIEWER_WRITABLE.some((prefix) => req.baseUrl.startsWith(prefix))
  if (writing && user.role === 'VIEWER' && !exempt) {
    return sendError(res, new HttpError(403, 'חשבון לצפייה בלבד אינו יכול לבצע שינויים'))
  }

  req.user = user
  next()
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, new HttpError(403, 'אין הרשאה לפעולה זו'))
    }
    next()
  }
}

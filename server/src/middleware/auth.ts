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

const secret = () => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return s
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, secret(), { expiresIn: '12h' })
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return sendError(res, new HttpError(401, 'נדרשת התחברות'))
  }
  try {
    req.user = jwt.verify(header.slice(7), secret()) as AuthUser
    next()
  } catch {
    sendError(res, new HttpError(401, 'ההתחברות פגה, יש להתחבר מחדש'))
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, new HttpError(403, 'אין הרשאה לפעולה זו'))
    }
    next()
  }
}

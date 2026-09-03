import type { Response } from 'express'
import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function sendError(res: Response, err: unknown) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message })
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'נתונים לא תקינים',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    })
  }
  console.error(err)
  return res.status(500).json({ error: 'שגיאת שרת פנימית' })
}

/** Wraps an async route handler so rejections become HTTP responses. */
export function handler(fn: (req: any, res: Response) => Promise<unknown>) {
  return async (req: any, res: Response) => {
    try {
      await fn(req, res)
    } catch (err) {
      sendError(res, err)
    }
  }
}

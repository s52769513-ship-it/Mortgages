import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { HttpError } from './http.js'

/**
 * Files live on disk under UPLOAD_DIR. In production that should point at a
 * mounted volume — a container's own filesystem does not survive a restart.
 */
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? 'uploads')

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })

/** Keeps only an extension we recognise, so a stored name can never be a path. */
function safeExtension(originalName: string) {
  const ext = path.extname(originalName).toLowerCase()
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : ''
}

const storage = multer.diskStorage({
  destination: (_req, _file, done) => done(null, UPLOAD_DIR),
  filename: (_req, file, done) =>
    done(null, `${Date.now()}-${randomBytes(8).toString('hex')}${safeExtension(file.originalname)}`),
})

export const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_BYTES } })

/**
 * Resolves a stored key back to a path inside UPLOAD_DIR, refusing anything
 * that tries to climb out of it.
 */
export function resolveStored(key: string) {
  const full = path.resolve(UPLOAD_DIR, key)
  if (full !== UPLOAD_DIR && !full.startsWith(UPLOAD_DIR + path.sep)) {
    throw new HttpError(400, 'נתיב קובץ לא תקין')
  }
  if (!existsSync(full)) throw new HttpError(404, 'הקובץ לא נמצא')
  return full
}

/** Multer reports an oversized upload through its own error type. */
export function uploadErrorMessage(err: unknown) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return `הקובץ גדול מדי. המגבלה היא ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`
  }
  return null
}

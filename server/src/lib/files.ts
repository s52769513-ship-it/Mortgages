import path from 'node:path'
import type { Response } from 'express'
import { resolveStored } from './storage.js'

/**
 * Serving an upload back is where a stored file becomes dangerous: a file
 * named "report.html" that the browser renders inline runs its script under
 * this origin, with everything a signed-in user can reach.
 *
 * So the browser is only ever told to render a type from this list. Anything
 * else — and anything whose type we cannot establish ourselves — is delivered
 * as a download the browser will not open in place.
 */
const INLINE_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.webm': 'audio/webm',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
}

/** Strips anything a filename could use to break out of the header. */
const safeName = (name: string) => encodeURIComponent(name.replace(/[\r\n"]/g, '_'))

export function sendStoredFile(res: Response, storageKey: string, displayName: string) {
  const fullPath = resolveStored(storageKey)

  // The type is decided from the extension we stored, never from the type the
  // uploader declared — that value is theirs to choose, and so is not trusted.
  const inlineType = INLINE_BY_EXTENSION[path.extname(storageKey).toLowerCase()]

  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'private, max-age=0')

  if (inlineType) {
    res.type(inlineType)
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${safeName(displayName)}`)
  } else {
    res.type('application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName(displayName)}`)
  }

  res.sendFile(fullPath)
}

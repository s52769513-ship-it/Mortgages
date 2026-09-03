import type { EntityType } from '@prisma/client'
import { prisma } from './prisma.js'

type Change = { field: string; oldValue: unknown; newValue: unknown }

const format = (v: unknown) =>
  v === null || v === undefined ? null : v instanceof Date ? v.toISOString() : String(v)

export async function logActivity(params: {
  entityType: EntityType
  entityId: string
  actorId?: string | null
  action: string
  changes?: Change[]
}) {
  const { entityType, entityId, actorId, action, changes } = params

  if (!changes || changes.length === 0) {
    await prisma.activityLog.create({
      data: { entityType, entityId, actorId: actorId ?? null, action },
    })
    return
  }

  await prisma.activityLog.createMany({
    data: changes.map((c) => ({
      entityType,
      entityId,
      actorId: actorId ?? null,
      action,
      field: c.field,
      oldValue: format(c.oldValue),
      newValue: format(c.newValue),
    })),
  })
}

/** Returns only the fields whose value actually changed. */
export function diff(before: Record<string, any>, after: Record<string, any>): Change[] {
  const changes: Change[] = []
  for (const [field, newValue] of Object.entries(after)) {
    if (newValue === undefined) continue
    const oldValue = before[field]
    const a = oldValue instanceof Date ? oldValue.getTime() : oldValue
    const b = newValue instanceof Date ? newValue.getTime() : newValue
    if (String(a ?? '') !== String(b ?? '')) changes.push({ field, oldValue, newValue })
  }
  return changes
}

import { EntityType } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { removeStored } from '../lib/storage.js'

/**
 * Deleting a mortgage file, or a client with their files.
 *
 * The database cascades what it can see: a file takes its tasks, documents,
 * bank applications, communications, expenses and professional links; a client
 * takes their files. Two things it cannot see, because they are not foreign
 * keys — the chat, which hangs off a record by type and id rather than by
 * relation, and the uploaded blobs on disk. Both are gathered here first and
 * removed alongside, so a deleted record leaves nothing addressed to it.
 *
 * The activity log is deliberately kept. It is the record of what was done,
 * including the deletion itself, and losing it would be losing the audit.
 */

/** Everything on a file that the chat and the notifications can be filed under. */
async function entitiesOf(fileIds: string[]) {
  const [tasks, documents, bankApps] = await Promise.all([
    prisma.task.findMany({ where: { fileId: { in: fileIds } }, select: { id: true } }),
    prisma.document.findMany({
      where: { fileId: { in: fileIds } },
      select: { id: true, storagePath: true },
    }),
    prisma.bankApplication.findMany({
      where: { fileId: { in: fileIds } },
      select: { id: true },
    }),
  ])

  const targets: { type: EntityType; ids: string[] }[] = [
    { type: EntityType.MORTGAGE_FILE, ids: fileIds },
    { type: EntityType.TASK, ids: tasks.map((t) => t.id) },
    { type: EntityType.DOCUMENT, ids: documents.map((d) => d.id) },
    { type: EntityType.BANK_APPLICATION, ids: bankApps.map((b) => b.id) },
  ]

  return { targets, documentBlobs: documents.map((d) => d.storagePath) }
}

/** Removes the chat, its attachments and any notifications aimed at these records. */
async function purgeConversations(targets: { type: EntityType; ids: string[] }[]) {
  const present = targets.filter((t) => t.ids.length > 0)
  if (present.length === 0) return []

  const where = { OR: present.map((t) => ({ entityType: t.type, entityId: { in: t.ids } })) }

  const comments = await prisma.comment.findMany({
    where,
    select: { id: true, attachments: { select: { storageKey: true } } },
  })
  const keys = comments.flatMap((c) => c.attachments.map((a) => a.storageKey))

  // Attachments and mention rows go with the comment; notifications may also
  // point at the record without a comment, so they are cleared by target too.
  await prisma.notification.deleteMany({ where })
  await prisma.comment.deleteMany({ where })

  return keys
}

/** Deletes one mortgage file and everything that only existed because of it. */
export async function deleteFileDeep(fileId: string) {
  const { targets, documentBlobs } = await entitiesOf([fileId])
  const chatBlobs = await purgeConversations(targets)

  await prisma.mortgageFile.delete({ where: { id: fileId } })
  await removeStored([...documentBlobs, ...chatBlobs])
}

/**
 * Deletes a client, their mortgage files, and everything under those.
 * Returns how many files went with them, for the activity entry.
 */
export async function deleteClientDeep(clientId: string) {
  const files = await prisma.mortgageFile.findMany({
    where: { clientId },
    select: { id: true },
  })
  const fileIds = files.map((f) => f.id)

  const { targets, documentBlobs } = fileIds.length
    ? await entitiesOf(fileIds)
    : { targets: [] as { type: EntityType; ids: string[] }[], documentBlobs: [] as (string | null)[] }

  // A document can be filed against the client rather than against a file —
  // `clientId` is a plain column, not a relation, so nothing cascades it.
  const loose = await prisma.document.findMany({
    where: { clientId, fileId: null },
    select: { id: true, storagePath: true },
  })

  const chatBlobs = await purgeConversations([
    ...targets,
    { type: EntityType.CLIENT, ids: [clientId] },
    { type: EntityType.DOCUMENT, ids: loose.map((d) => d.id) },
  ])

  await prisma.document.deleteMany({ where: { clientId, fileId: null } })
  await prisma.client.delete({ where: { id: clientId } })
  await removeStored([...documentBlobs, ...loose.map((d) => d.storagePath), ...chatBlobs])

  return fileIds.length
}

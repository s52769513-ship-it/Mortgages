import { prisma } from './prisma.js'

export type Numbered = 'task' | 'document' | 'bankApplication'

/**
 * Next running number within a file. The office refers to "task 3 on the
 * file", so the sequence restarts per file rather than running globally.
 */
async function nextSeq(model: Numbered, fileId: string) {
  const highest =
    model === 'task'
      ? await prisma.task.aggregate({ where: { fileId }, _max: { seq: true } })
      : model === 'document'
        ? await prisma.document.aggregate({ where: { fileId }, _max: { seq: true } })
        : await prisma.bankApplication.aggregate({ where: { fileId }, _max: { seq: true } })

  return (highest._max.seq ?? 0) + 1
}

/**
 * Runs a create with the next number, retrying once if another writer took it
 * first. Two people adding in the same instant is the only way that happens,
 * and one retry is enough at this scale.
 */
export async function withSeq<T>(
  model: Numbered,
  fileId: string,
  create: (seq: number) => Promise<T>,
): Promise<T> {
  try {
    return await create(await nextSeq(model, fileId))
  } catch (e) {
    if ((e as { code?: string })?.code !== 'P2002') throw e
    return create(await nextSeq(model, fileId))
  }
}

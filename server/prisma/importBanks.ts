import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { importBanks } from '../src/services/importBanks.js'

const summary = await importBanks()
console.log(
  `Imported ${summary.banks} banks and ${summary.branches} branches.` +
    (summary.skipped ? ` Skipped ${summary.skipped} rows with no usable name.` : ''),
)
await prisma.$disconnect()

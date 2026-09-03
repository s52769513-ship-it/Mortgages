import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BANKS = [
  'בנק הפועלים',
  'בנק לאומי',
  'בנק מזרחי טפחות',
  'בנק דיסקונט',
  'הבנק הבינלאומי',
  'בנק ירושלים',
]

async function main() {
  const password = await bcrypt.hash('Admin12345', 10)

  const admin = await prisma.employee.upsert({
    where: { email: 'admin@mortgages.local' },
    update: {},
    create: {
      name: 'מנהל המערכת',
      email: 'admin@mortgages.local',
      password,
      role: 'ADMIN',
    },
  })

  for (const name of BANKS) {
    await prisma.bank.upsert({ where: { name }, update: {}, create: { name } })
  }

  const client = await prisma.client.upsert({
    where: { id: 'seed-client-1' },
    update: {},
    create: {
      id: 'seed-client-1',
      fullName: 'ישראל ישראלי',
      phone: '050-1234567',
      email: 'israel@example.com',
      leadStatus: 'CONVERTED',
      referralSource: 'המלצה',
      ownerId: admin.id,
      introNotes: 'מחפש משכנתא לדירה ראשונה באזור המרכז.',
    },
  })

  const bank = await prisma.bank.findFirst({ where: { name: 'בנק הפועלים' } })

  const file = await prisma.mortgageFile.upsert({
    where: { fileNumber: 'MF-2026-0001' },
    update: {},
    create: {
      fileNumber: 'MF-2026-0001',
      clientId: client.id,
      ownerId: admin.id,
      dealType: 'רכישת דירה',
      propertyType: 'דירה',
      propertyAddress: 'רחוב הרצל 15, תל אביב',
      purchasePrice: 2_400_000,
      propertyValue: 2_450_000,
      requestedAmount: 1_600_000,
      ltvPercent: 66.67,
      equity: 800_000,
      desiredMonthly: 7_500,
      stage: 'DOCUMENT_COLLECTION',
      status: 'ACTIVE',
      urgency: 'HIGH',
      targetBankId: bank?.id,
      nextAction: 'להשלים תלושי שכר של 3 חודשים אחרונים',
      nextActionDate: new Date(Date.now() + 3 * 864e5),
    },
  })

  const existingTasks = await prisma.task.count({ where: { fileId: file.id } })
  if (existingTasks === 0) {
    await prisma.task.createMany({
      data: [
        {
          title: 'איסוף תלושי שכר',
          fileId: file.id,
          ownerId: admin.id,
          createdById: admin.id,
          stage: 'DOCUMENT_COLLECTION',
          status: 'WAITING_CLIENT',
          priority: 'HIGH',
          dueAt: new Date(Date.now() + 2 * 864e5),
          waitingOn: 'הלקוח',
          description: '3 תלושים אחרונים לשני בני הזוג.',
        },
        {
          title: 'הזמנת שמאות',
          fileId: file.id,
          ownerId: admin.id,
          createdById: admin.id,
          stage: 'APPRAISAL',
          status: 'OPEN',
          priority: 'NORMAL',
          dueAt: new Date(Date.now() + 7 * 864e5),
        },
      ],
    })
  }

  console.log('Seed complete. Login: admin@mortgages.local / Admin12345')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

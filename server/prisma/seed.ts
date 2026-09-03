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
          stage: 'COLLATERAL',
          status: 'OPEN',
          priority: 'NORMAL',
          dueAt: new Date(Date.now() + 7 * 864e5),
        },
      ],
    })
  }

  // A second file that is stuck, so the blocked-files panel has something real.
  const blockedClient = await prisma.client.upsert({
    where: { id: 'seed-client-2' },
    update: {},
    create: {
      id: 'seed-client-2',
      fullName: 'מיכל ברק',
      phone: '052-441-9087',
      email: 'michal@example.com',
      leadStatus: 'CONTACTED',
      referralSource: 'המלצת עו״ד',
      ownerId: admin.id,
    },
  })

  const blockedFile = await prisma.mortgageFile.upsert({
    where: { fileNumber: 'MF-2026-0002' },
    update: {},
    create: {
      fileNumber: 'MF-2026-0002',
      clientId: blockedClient.id,
      ownerId: admin.id,
      dealType: 'מחזור משכנתא',
      propertyType: 'דירה',
      propertyAddress: 'שדרות ירושלים 42, רמת גן',
      purchasePrice: 2_150_000,
      requestedAmount: 1_450_000,
      ltvPercent: 67,
      equity: 700_000,
      stage: 'BANK_SUBMISSION',
      status: 'BLOCKED',
      urgency: 'CRITICAL',
      blockReason: 'חסרים מסמכים',
      nextAction: 'הגשת חבילת מסמכים לבנק מרכנתיל',
      nextActionDate: new Date(Date.now() + 864e5),
    },
  })

  if ((await prisma.task.count({ where: { fileId: blockedFile.id } })) === 0) {
    await prisma.task.createMany({
      data: [
        {
          title: 'השלמת תדפיסי בנק',
          fileId: blockedFile.id,
          ownerId: admin.id,
          createdById: admin.id,
          stage: 'DOCUMENT_COLLECTION',
          status: 'WAITING_CLIENT',
          priority: 'URGENT',
          dueAt: new Date(Date.now() - 6 * 864e5),
          waitingOn: 'הלקוח',
        },
        {
          title: 'הגשת בקשה — בנק מרכנתיל',
          fileId: blockedFile.id,
          ownerId: admin.id,
          createdById: admin.id,
          stage: 'BANK_SUBMISSION',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          dueAt: new Date(new Date().setHours(16, 0, 0, 0)),
        },
      ],
    })
  }

  if ((await prisma.document.count({ where: { fileId: blockedFile.id } })) === 0) {
    await prisma.document.createMany({
      data: [
        {
          docType: 'תלושי שכר · 3 חודשים',
          fileName: 'payslips.pdf',
          fileId: blockedFile.id,
          status: 'APPROVED',
          isValid: true,
          version: 1,
          receivedAt: new Date(Date.now() - 5 * 864e5),
          allowedForBank: true,
        },
        {
          docType: 'תדפיסי חשבון',
          fileName: 'statements.pdf',
          fileId: blockedFile.id,
          status: 'UNDER_REVIEW',
          version: 2,
          receivedAt: new Date(Date.now() - 2 * 864e5),
        },
        {
          docType: 'נסח טאבו',
          fileName: 'tabu.pdf',
          fileId: blockedFile.id,
          status: 'INVALID',
          isValid: false,
          issueNotes: 'חסר עמוד שני',
          version: 1,
        },
        {
          docType: 'אישור הון עצמי',
          fileName: '',
          fileId: blockedFile.id,
          status: 'REQUESTED',
          version: 1,
          issueNotes: 'ממתין ללקוח',
        },
      ],
    })
  }

  if ((await prisma.bankApplication.count({ where: { fileId: blockedFile.id } })) === 0) {
    const mercantile = await prisma.bank.upsert({
      where: { name: 'בנק מרכנתיל' },
      update: {},
      create: { name: 'בנק מרכנתיל' },
    })
    const leumi = await prisma.bank.findFirst({ where: { name: 'בנק לאומי' } })

    await prisma.bankApplication.createMany({
      data: [
        {
          fileId: blockedFile.id,
          bankId: mercantile.id,
          status: 'UNDER_REVIEW',
          requestedAmount: 1_450_000,
          ltvPercent: 67,
          offeredRates: '4.9% · מסלול קבוע',
          missingItems: '2 מסמכים',
          submittedAt: new Date(Date.now() - 3 * 864e5),
        },
        ...(leumi
          ? [
              {
                fileId: blockedFile.id,
                bankId: leumi.id,
                status: 'APPROVED_IN_PRINCIPLE' as const,
                requestedAmount: 1_400_000,
                ltvPercent: 65,
                offeredRates: '4.7% · תמהיל',
                approvalInPrinciple: true,
                approvalDate: new Date(Date.now() - 864e5),
                approvalValidUntil: new Date(Date.now() + 27 * 864e5),
                submittedAt: new Date(Date.now() - 4 * 864e5),
              },
            ]
          : []),
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

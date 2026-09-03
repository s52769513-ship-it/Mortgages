import bcrypt from 'bcryptjs'
import { prisma } from './prisma.js'

/**
 * Creates the first administrator on an empty install, from ADMIN_EMAIL and
 * ADMIN_PASSWORD. It runs only while there are no employees at all, so it
 * cannot overwrite a real account or resurrect one that was removed — once
 * anybody exists, this is a no-op and the variables can be deleted.
 */
export async function bootstrapFirstAdmin() {
  if ((await prisma.employee.count()) > 0) return

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME?.trim() || 'מנהל המערכת'

  if (!email || !password) {
    console.warn(
      'No employees yet. Set ADMIN_EMAIL and ADMIN_PASSWORD and restart to create the first administrator.',
    )
    return
  }

  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters. No account was created.')
    return
  }

  await prisma.employee.create({
    data: { name, email, password: await bcrypt.hash(password, 10), role: 'ADMIN' },
  })

  console.log(`Created the first administrator: ${email}`)
}

/**
 * Checks the configuration before anything connects.
 *
 * Only what makes the service unable to function at all stops the boot: no
 * database, no signing secret. A weak secret is shouted about in the log on
 * every start, but the office keeps working — a site that is down because a
 * variable was pasted into the wrong service is the worse outcome.
 */
export function assertEnv() {
  const production = process.env.NODE_ENV === 'production'
  const fatal: string[] = []
  const warnings: string[] = []

  if (!process.env.DATABASE_URL) fatal.push('DATABASE_URL is not set')

  const secret = process.env.JWT_SECRET?.trim()
  if (!secret) fatal.push('JWT_SECRET is not set')
  else if (production && secret === 'change-me-in-production') {
    warnings.push('JWT_SECRET still holds the placeholder value — set a random one (32+ characters)')
  } else if (production && secret.length < 32) {
    warnings.push(`JWT_SECRET is only ${secret.length} characters — use at least 32 random ones`)
  }

  if (fatal.length) {
    console.error('Refusing to start:\n  - ' + fatal.join('\n  - '))
    process.exit(1)
  }
  for (const w of warnings) console.warn(`WARNING: ${w}`)
}

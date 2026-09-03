/**
 * Checks the configuration before anything connects, so a misconfigured deploy
 * fails at boot with a message naming the problem — not at the first login,
 * after the health check has already reported the service as fine.
 */
export function assertEnv() {
  const production = process.env.NODE_ENV === 'production'
  const problems: string[] = []

  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set')

  const secret = process.env.JWT_SECRET
  if (!secret) problems.push('JWT_SECRET is not set')
  else if (production && secret.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters in production')
  } else if (production && secret === 'change-me-in-production') {
    problems.push('JWT_SECRET still holds the placeholder value')
  }

  if (problems.length) {
    console.error('Refusing to start:\n  - ' + problems.join('\n  - '))
    process.exit(1)
  }
}

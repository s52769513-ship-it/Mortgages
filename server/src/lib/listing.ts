/**
 * Shared paging and sorting for the list endpoints. The sort field is checked
 * against an allowlist per route rather than passed through, so a query
 * parameter can never name an arbitrary column.
 */

const DEFAULT_TAKE = 25
const MAX_TAKE = 200

export type SortDirection = 'asc' | 'desc'

export function parsePaging(query: Record<string, unknown>) {
  const take = Math.min(Math.max(Number(query.take) || DEFAULT_TAKE, 1), MAX_TAKE)
  const skip = Math.max(Number(query.skip) || 0, 0)
  return { take, skip }
}

/**
 * Builds an orderBy from ?sort= and ?dir=, falling back to the route's own
 * default when the field is not one it allows.
 */
export function parseSort<T extends string>(
  query: Record<string, unknown>,
  allowed: readonly T[],
  fallback: object | object[],
): object | object[] {
  const field = String(query.sort ?? '')
  const direction: SortDirection = query.dir === 'asc' ? 'asc' : 'desc'

  if (!allowed.includes(field as T)) return fallback

  // A dotted field addresses a relation, e.g. "client.fullName".
  const [head, tail] = field.split('.')
  return tail ? { [head]: { [tail]: direction } } : { [field]: direction }
}

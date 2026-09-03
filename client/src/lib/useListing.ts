import { useEffect, useState } from 'react'
import type { Sort } from '@/components/DataTable'

export const PAGE_SIZE = 25

/**
 * Paging and sorting state for a list screen. Changing a filter returns to the
 * first page — staying on page 4 of a result set that now has one page shows
 * an empty list and reads as a bug.
 */
export function useListing(filterKey: string) {
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<Sort>(null)

  useEffect(() => {
    setPage(0)
  }, [filterKey])

  return {
    page,
    setPage,
    sort,
    setSort: (next: Sort) => {
      setSort(next)
      setPage(0)
    },
    params: {
      take: PAGE_SIZE,
      skip: page * PAGE_SIZE,
      ...(sort ? { sort: sort.field, dir: sort.dir } : {}),
    },
    pageSize: PAGE_SIZE,
  }
}

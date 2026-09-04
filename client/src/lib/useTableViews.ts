import { useCallback, useEffect, useState } from 'react'

/**
 * Per-user list preferences, kept in localStorage. A saved view is the whole
 * shape of a list screen — its search, its filters and its sort — under a name
 * the office chose. Hidden columns are separate: they follow the person, not
 * the view, so switching views does not rearrange the table underneath them.
 */

export type SavedView<S> = { id: string; name: string; state: S }

const viewsKey = (scope: string) => `mortgages.views.${scope}`
const columnsKey = (scope: string) => `mortgages.columns.${scope}`

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable — preferences stay for this session only */
  }
}

export function useSavedViews<S>(scope: string) {
  const [views, setViews] = useState<SavedView<S>[]>(() => read(viewsKey(scope), []))
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    write(viewsKey(scope), views)
  }, [scope, views])

  const save = useCallback((name: string, state: S) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = `${Date.now()}`
    // Saving over an existing name replaces it rather than making a twin.
    setViews((prev) => {
      const existing = prev.find((v) => v.name === trimmed)
      if (existing) {
        setActiveId(existing.id)
        return prev.map((v) => (v.id === existing.id ? { ...v, state } : v))
      }
      setActiveId(id)
      return [...prev, { id, name: trimmed, state }]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id))
    setActiveId((current) => (current === id ? null : current))
  }, [])

  return { views, activeId, setActiveId, save, remove }
}

export function useHiddenColumns(scope: string, locked: string[] = []) {
  const [hidden, setHidden] = useState<string[]>(() => read(columnsKey(scope), []))

  useEffect(() => {
    write(columnsKey(scope), hidden)
  }, [scope, hidden])

  const toggle = useCallback(
    (key: string) => {
      if (locked.includes(key)) return
      setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locked.join('|')],
  )

  const reset = useCallback(() => setHidden([]), [])

  return { hidden, toggle, reset, isHidden: (key: string) => hidden.includes(key) }
}

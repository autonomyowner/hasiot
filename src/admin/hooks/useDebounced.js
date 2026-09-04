import { useEffect, useState } from 'react'

/**
 * Hold a value still until it stops changing.
 *
 * Every search box in the panel drives a Convex query, and Convex re-runs a
 * query on every argument change — so without this, typing "Hofuf" fires five
 * searches and the first four are wasted before their results arrive.
 */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}

import { useEffect, useState } from 'react'

/**
 * Follows `value` after it has stayed unchanged for `delayMs`. Typing into a
 * search box updates the text on every keystroke; the debounced copy is what
 * the request reads, so a word costs one request instead of one per letter.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

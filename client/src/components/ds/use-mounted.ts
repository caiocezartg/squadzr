import { useEffect, useState } from 'react'

/**
 * False for the first render and true from the first effect on. Base UI plays an enter only when
 * `open` turns true after the dialog mounted, so a surface a parent mounts already open renders
 * `open && mounted` and opens right after.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

import { useCallback, useEffect, useState } from 'react'

/** How long a "copied" confirmation stays on screen. */
const COPIED_CONFIRMATION_MS = 2_000

/**
 * The "copied" state of a copy button. `markCopied` turns the confirmation on, and one effect turns it off
 * again after two seconds. A copy made while the confirmation shows restarts the timer, and leaving the page
 * clears it.
 */
export function useCopiedFlag(): [copied: boolean, markCopied: () => void] {
  const [copiedAt, setCopiedAt] = useState<number | null>(null)

  useEffect(() => {
    if (copiedAt === null) return

    const timer = setTimeout(() => setCopiedAt(null), COPIED_CONFIRMATION_MS)
    return () => clearTimeout(timer)
  }, [copiedAt])

  const markCopied = useCallback(() => setCopiedAt(Date.now()), [])

  return [copiedAt !== null, markCopied]
}

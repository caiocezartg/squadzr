import { useCallback, useEffect, useState } from 'react'

/** How long a "copied" confirmation stays on screen unless the button asks for another time. */
const COPIED_CONFIRMATION_MS = 2_000

/**
 * The "copied" state of a copy button. `markCopied` turns the confirmation on, and one effect turns it off
 * again after `durationMs`, two seconds by default. A copy made while the confirmation shows restarts the timer, and leaving the page
 * clears it.
 */
export function useCopiedFlag(
  durationMs = COPIED_CONFIRMATION_MS
): [copied: boolean, markCopied: () => void] {
  const [copiedAt, setCopiedAt] = useState<number | null>(null)

  useEffect(() => {
    if (copiedAt === null) return

    const timer = setTimeout(() => setCopiedAt(null), durationMs)
    return () => clearTimeout(timer)
  }, [copiedAt, durationMs])

  const markCopied = useCallback(() => setCopiedAt(Date.now()), [])

  return [copiedAt !== null, markCopied]
}

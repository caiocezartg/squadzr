'use client'

import { useCallback, useState } from 'react'

interface ChangeDetails {
  reason: string
  isCanceled: boolean
}

/**
 * Escape takes effect without a transition (docs/design/reference.md, Motion, Rules). Base UI reports
 * why a surface closed; this keeps the Escape reason for the surface to mark with `data-instant`. The
 * next open or pointer close clears it, so those still animate. A close the parent cancels keeps the
 * surface as it was.
 */
export function useInstantDismiss<Details extends ChangeDetails>(
  onOpenChange: ((open: boolean, details: Details) => void) | undefined
) {
  const [instant, setInstant] = useState(false)

  const handleOpenChange = useCallback(
    (open: boolean, details: Details) => {
      onOpenChange?.(open, details)
      if (details.isCanceled) return
      setInstant(!open && details.reason === 'escape-key')
    },
    [onOpenChange]
  )

  return { instant, handleOpenChange }
}

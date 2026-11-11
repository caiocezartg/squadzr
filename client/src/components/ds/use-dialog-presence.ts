import { useCallback, useState } from 'react'

type Phase = 'closed' | 'open' | 'closing'

interface Presence {
  phase: Phase
  key: number
}

/**
 * What a parent needs to show a `Dialog` it mounts only while it is wanted: `mounted` says whether to
 * render it, `open` is the dialog's `open`, and `exited` goes to its `onOpenChangeComplete(false)` so the
 * dialog leaves the tree after its exit transition instead of before it. A `show` after a hide hands out a
 * new `key`, so a dialog shown again starts from its initial state even while the last one is still leaving;
 * a `show` while it is already open keeps the key, so a double click does not reset it.
 */
export function useDialogPresence() {
  const [{ phase, key }, setPresence] = useState<Presence>({ phase: 'closed', key: 0 })

  const show = useCallback(
    () =>
      setPresence((current) =>
        current.phase === 'open' ? current : { phase: 'open', key: current.key + 1 }
      ),
    []
  )
  const hide = useCallback(
    () =>
      setPresence((current) =>
        current.phase === 'open' ? { ...current, phase: 'closing' } : current
      ),
    []
  )
  const exited = useCallback((open: boolean) => {
    if (open) return
    setPresence((current) =>
      current.phase === 'closing' ? { ...current, phase: 'closed' } : current
    )
  }, [])

  return { mounted: phase !== 'closed', open: phase === 'open', key, show, hide, exited }
}

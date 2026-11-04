import { useCallback, useState } from 'react'

type Phase = 'closed' | 'open' | 'closing'

/**
 * What a parent needs to show a `Dialog` it mounts only while it is wanted: `mounted` says whether to
 * render it, `open` is the dialog's `open`, and `exited` goes to its `onOpenChangeComplete(false)` so the
 * dialog leaves the tree after its exit transition instead of before it. Every `show` hands out a new
 * `key`, so a dialog shown again starts from its initial state even while the last one is still leaving.
 */
export function useDialogPresence() {
  const [phase, setPhase] = useState<Phase>('closed')
  const [key, setKey] = useState(0)

  const show = useCallback(() => {
    setKey((current) => current + 1)
    setPhase('open')
  }, [])
  const hide = useCallback(
    () => setPhase((current) => (current === 'open' ? 'closing' : current)),
    []
  )
  const exited = useCallback((open: boolean) => {
    if (!open) setPhase((current) => (current === 'closing' ? 'closed' : current))
  }, [])

  return { mounted: phase !== 'closed', open: phase === 'open', key, show, hide, exited }
}

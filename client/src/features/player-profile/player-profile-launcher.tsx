'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useDialogPresence } from '@/components/ds/use-dialog-presence'
import { PlayerProfileDialog } from './player-profile-dialog'
import { useCloseProfileFromUrl, usePlayerFromUrl } from './use-player-profile-link'

/**
 * Owns the one profile dialog of the shell. The URL's `?player=<id>` is the only source of truth: the
 * dialog opens when the parameter appears (a tile, "My profile", a shared link, Forward) and closes when
 * it goes (the close button, Escape, the backdrop, Back). The page below never navigates, so the Lobby
 * keeps its live channel and Presence. The dialog is mounted while it is shown and keeps the last person
 * while it leaves, so its exit never flashes another profile.
 */
export function PlayerProfileLauncher({ children }: { readonly children: ReactNode }) {
  const requested = usePlayerFromUrl()
  const presence = useDialogPresence()
  const closeFromUrl = useCloseProfileFromUrl()
  const { show, hide } = presence

  // The last person asked for, kept after the parameter is gone so the exit transition still has one.
  const [shown, setShown] = useState(requested)
  if (requested && requested !== shown) setShown(requested)

  useEffect(() => {
    if (requested) show()
    else hide()
  }, [requested, show, hide])

  const close = () => {
    hide()
    closeFromUrl()
  }

  return (
    <>
      {children}
      {presence.mounted && shown && (
        <PlayerProfileDialog
          key={presence.key}
          playerId={shown}
          open={presence.open}
          onClose={close}
          onOpenChangeComplete={presence.exited}
        />
      )}
    </>
  )
}

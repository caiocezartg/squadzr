import { useEffect, useRef } from 'react'
import type { SessionDto } from '@squadzr/schemas'
import type { SquadSearchAccess } from '@/features/squad-list'

interface UseInviteLinkOptions {
  search: SquadSearchAccess
  session: SessionDto | null
  /** Opens the Squad's Lobby, where a non-member chooses whether to join. */
  openLobby: (code: string) => void
}

/**
 * Opens the Lobby of the Squad named by the `?join=` search param, once. The link never joins by itself:
 * any site can send a signed-in player to it, so joining stays the player's own click on the Lobby's
 * "Join squad". The URL stays the public entry point for shared invites; visitors get the sign-in prompt
 * instead (see `useSquadJoining`).
 */
export function useInviteLink({ search, session, openLobby }: UseInviteLinkOptions): void {
  const joinCode = search.search.join
  const openedCodeRef = useRef<string | null>(null)

  useEffect(() => {
    if (!session?.user) return
    if (!joinCode || openedCodeRef.current === joinCode) return

    openedCodeRef.current = joinCode
    openLobby(joinCode)
  }, [session?.user, joinCode, openLobby])
}

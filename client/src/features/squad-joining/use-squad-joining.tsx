import { useState, type ReactNode } from 'react'
import { useSession } from '@/hooks/use-session'
import { signInWithDiscord } from '@/lib/auth-client'
import { useAppNavigation } from '@/lib/navigation'
import { joinHref, lobbyHref } from '@/lib/squad-links'
import type { SquadSearchAccess } from '@/features/squad-list'
import { JoinSquadAuthModal } from './join-squad-auth-modal'
import { useInviteLink } from './use-invite-link'
import { useJoinSquad } from './use-join-squad'

/** The squad facts the join flow needs from a board card. */
export interface JoinableSquad {
  code: string
  isMember?: boolean
}

export interface SquadJoining {
  /**
   * Handles a squad card activation: members go straight to the lobby, guests
   * get the sign-in prompt, authenticated users join the squad.
   */
  requestJoin: (squad: JoinableSquad) => void
  /** Squad code with a join request in flight, for the card loading state. */
  joiningSquadCode: string | null
  /** The guest sign-in prompt; render once in the page. */
  authPrompt: ReactNode
}

/**
 * The join workflow for the Squad Board: the mutation validates the shared
 * response contract, typed application errors become toasts, the board is
 * refreshed before navigating to the lobby, and the `?join=` invite link
 * opens the Squad's Lobby once, where the player chooses to join. A visitor who opens the invite link gets the sign-in prompt for its code. The
 * sign-in callback keeps the intended squad code so it survives the Discord round trip. `invite`
 * is the board's URL access.
 */
export function useSquadJoining(invite: SquadSearchAccess): SquadJoining {
  const navigateApp = useAppNavigation()
  const session = useSession()
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null)
  // The invite code of a visitor's link whose prompt the visitor closed, so closing it holds.
  const [dismissedInviteCode, setDismissedInviteCode] = useState<string | null>(null)
  const [joiningSquadCode, setJoiningSquadCode] = useState<string | null>(null)

  const { join } = useJoinSquad({
    onJoined: (squadCode) => navigateApp(lobbyHref(squadCode)),
    onFailed: () => setJoiningSquadCode(null),
  })

  useInviteLink({ search: invite, session, openLobby: (code) => navigateApp(lobbyHref(code)) })

  const requestJoin = (squad: JoinableSquad) => {
    if (squad.isMember) {
      navigateApp(lobbyHref(squad.code))
    } else if (!session?.user) {
      setPendingJoinCode(squad.code)
    } else {
      setJoiningSquadCode(squad.code)
      join(squad.code)
    }
  }

  // A visitor who opens an invite link is asked to sign in for that squad before anything else.
  const inviteCode = invite.search.join
  const visitorInviteCode =
    !session?.user && inviteCode && inviteCode !== dismissedInviteCode ? inviteCode : null
  const promptCode = pendingJoinCode ?? visitorInviteCode

  const closePrompt = () => {
    setPendingJoinCode(null)
    setDismissedInviteCode(inviteCode ?? null)
  }

  const handleSignIn = () => {
    if (!promptCode) return

    signInWithDiscord(joinHref(promptCode))
  }

  // The prompt stays mounted, still naming its Squad, until its exit transition has finished.
  const [shownCode, setShownCode] = useState<string | null>(null)
  if (promptCode !== null && promptCode !== shownCode) setShownCode(promptCode)

  const authPrompt =
    shownCode !== null ? (
      <JoinSquadAuthModal
        key={shownCode}
        open={promptCode !== null}
        squadCode={shownCode}
        onOpenChange={(open) => {
          if (!open) closePrompt()
        }}
        onOpenChangeComplete={(open) => {
          if (!open && promptCode === null) setShownCode(null)
        }}
        onSignIn={handleSignIn}
      />
    ) : null

  return { requestJoin, joiningSquadCode, authPrompt }
}

import { useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { joinRoomResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import { useSession } from '@/hooks/use-session'
import { signInWithDiscord } from '@/lib/auth-client'
import { useAppNavigation } from '@/lib/navigation'
import { getUserFriendlyError } from '@/lib/error-messages'
import { notifyError } from '@/lib/notify'
import { joinHref, lobbyHref } from '@/lib/squad-links'
// The board's barrel exports only its cache commands, so this import cannot close a cycle back to the page.
import { useMySquadsCommands } from '@/features/my-squads'
import { useSquadBoardCommands } from '@/features/squad-board'
import type { SquadSearchAccess } from '@/features/squad-list'
import { JoinSquadAuthModal } from './join-squad-auth-modal'
import { useAutoJoin } from './use-auto-join'

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
 * auto-joins once. A visitor who opens the invite link gets the sign-in prompt for its code. The
 * sign-in callback keeps the intended squad code so it survives the Discord round trip. `invite`
 * is the board's URL access.
 */
export function useSquadJoining(invite: SquadSearchAccess): SquadJoining {
  const t = useTranslations()
  const navigateApp = useAppNavigation()
  const session = useSession()
  const { refreshSquads } = useSquadBoardCommands()
  const { refreshMySquads } = useMySquadsCommands()
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null)
  // The invite code of a visitor's link whose prompt the visitor closed, so closing it holds.
  const [dismissedInviteCode, setDismissedInviteCode] = useState<string | null>(null)
  const [joiningSquadCode, setJoiningSquadCode] = useState<string | null>(null)

  const joinSquadMutation = useMutation({
    mutationFn: (squadCode: string) =>
      api.post(`/api/rooms/${encodeURIComponent(squadCode)}/join`, {}, joinRoomResponseSchema),
    onSuccess: async (_, squadCode) => {
      await Promise.all([refreshSquads(), refreshMySquads()])
      navigateApp(lobbyHref(squadCode))
    },
    onError: (err) => {
      setJoiningSquadCode(null)
      notifyError(getUserFriendlyError(err, t, 'join'))
    },
  })

  useAutoJoin({ search: invite, session, mutate: joinSquadMutation.mutate })

  const requestJoin = (squad: JoinableSquad) => {
    if (squad.isMember) {
      navigateApp(lobbyHref(squad.code))
    } else if (!session?.user) {
      setPendingJoinCode(squad.code)
    } else {
      setJoiningSquadCode(squad.code)
      joinSquadMutation.mutate(squad.code)
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

  const authPrompt =
    promptCode !== null ? (
      <JoinSquadAuthModal
        open
        squadCode={promptCode}
        onOpenChange={(open) => {
          if (!open) closePrompt()
        }}
        onSignIn={handleSignIn}
      />
    ) : null

  return { requestJoin, joiningSquadCode, authPrompt }
}

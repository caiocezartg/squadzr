import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { joinRoomResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import { useSession } from '@/hooks/use-session'
import { signInWithDiscord } from '@/lib/auth-client'
import { useAppNavigation } from '@/lib/navigation'
import { getUserFriendlyError } from '@/lib/error-messages'
import { notifyError } from '@/lib/notify'
import { lobbyHref } from '@/lib/squad-links'
import { ModalLoading } from '@/components/ui/modal-loading'
import { LazyIslandBoundary } from '@/components/ui/lazy-island-boundary'
// The board's barrel exports only its cache commands, so this import cannot close a cycle back to the page.
import { useSquadBoardCommands } from '@/features/squad-board'
import type { SquadSearchAccess } from '@/features/squad-list'
import { useAutoJoin } from './use-auto-join'

// The guest prompt is a non-essential sub-capability: its dialog primitives
// and animation runtime load only when a guest actually tries to join.
const LazyJoinSquadAuthModal = lazy(() =>
  import('./join-squad-auth-modal').then((module) => ({ default: module.JoinSquadAuthModal }))
)

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
  /** Squad code with a join request in flight, for the card spinner. */
  joiningSquadCode: string | null
  /** The guest sign-in prompt; render once in the page. */
  authPrompt: ReactNode
}

/**
 * The join workflow for the Squad Board: the mutation validates the shared
 * response contract, typed application errors become toasts, the board is
 * refreshed before navigating to the lobby, and the `?join=` invite link
 * auto-joins once. The sign-in callback keeps the intended squad code so it
 * survives the Discord round trip. `invite` is the board's URL access.
 */
export function useSquadJoining(invite: SquadSearchAccess): SquadJoining {
  const t = useTranslations()
  const navigateApp = useAppNavigation()
  const session = useSession()
  const { refreshSquads } = useSquadBoardCommands()
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null)
  const [joiningSquadCode, setJoiningSquadCode] = useState<string | null>(null)

  const joinSquadMutation = useMutation({
    mutationFn: (squadCode: string) =>
      api.post(`/api/rooms/${encodeURIComponent(squadCode)}/join`, {}, joinRoomResponseSchema),
    onSuccess: async (_, squadCode) => {
      await refreshSquads()
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

  const handleSignIn = () => {
    if (!pendingJoinCode) return

    signInWithDiscord(`/squads?join=${encodeURIComponent(pendingJoinCode)}`)
  }

  const authPrompt =
    pendingJoinCode !== null ? (
      <LazyIslandBoundary
        fallback={null}
        onError={() => notifyError(t('errors.DIALOG_LOAD_FAILED'))}
      >
        <Suspense fallback={<ModalLoading />}>
          <LazyJoinSquadAuthModal
            open
            squadCode={pendingJoinCode}
            onOpenChange={(open) => {
              if (!open) setPendingJoinCode(null)
            }}
            onSignIn={handleSignIn}
          />
        </Suspense>
      </LazyIslandBoundary>
    ) : null

  return { requestJoin, joiningSquadCode, authPrompt }
}

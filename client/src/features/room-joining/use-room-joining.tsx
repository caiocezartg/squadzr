import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { joinRoomResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import { signIn, useSession } from '@/lib/auth-client'
// The commands entry point is the catalog's cross-capability port. Importing
// it instead of the barrel keeps the catalog page (which renders the join
// flow) out of a cycle.
import { useCatalogCommands } from '@/features/catalog/commands'
import { getUserFriendlyError } from '@/lib/error-messages'
import { notifyError } from '@/lib/notify'
import { ModalLoading } from '@/components/ui/modal-loading'
import { useAutoJoin } from './use-auto-join'

// The guest prompt is a non-essential sub-capability: its dialog primitives
// and animation runtime load only when a guest actually tries to join.
const LazyJoinRoomAuthModal = lazy(() =>
  import('./join-room-auth-modal').then((module) => ({ default: module.JoinRoomAuthModal }))
)

/** The room facts the join flow needs from a catalog card. */
export interface JoinableRoom {
  code: string
  isMember?: boolean
}

export interface RoomJoining {
  /**
   * Handles a room card activation: members go straight to the lobby, guests
   * get the sign-in prompt, authenticated users join the room.
   */
  requestJoin: (room: JoinableRoom) => void
  /** Room code with a join request in flight, for the card spinner. */
  joiningRoomCode: string | null
  /** The guest sign-in prompt; render once in the page. */
  authPrompt: ReactNode
}

/**
 * The join-room workflow for the catalog: the mutation validates the shared
 * response contract, typed application errors become toasts, the catalog is
 * refreshed before navigating to the lobby, and the `?join=` invite link
 * auto-joins once. The sign-in callback keeps the intended room code so it
 * survives the Discord round trip.
 */
export function useRoomJoining(): RoomJoining {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const { refreshRooms } = useCatalogCommands()
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null)
  const [joiningRoomCode, setJoiningRoomCode] = useState<string | null>(null)

  const joinRoomMutation = useMutation({
    mutationFn: (roomCode: string) =>
      api.post(`/api/rooms/${roomCode}/join`, {}, joinRoomResponseSchema),
    onSuccess: async (_, roomCode) => {
      await refreshRooms()
      navigate({ to: '/rooms/$code', params: { code: roomCode } })
    },
    onError: (err) => {
      setJoiningRoomCode(null)
      void notifyError(getUserFriendlyError(err, 'join'))
    },
  })

  useAutoJoin({ session, mutate: joinRoomMutation.mutate })

  const requestJoin = (room: JoinableRoom) => {
    if (room.isMember) {
      navigate({ to: '/rooms/$code', params: { code: room.code } })
    } else if (!session?.user) {
      setPendingJoinCode(room.code)
    } else {
      setJoiningRoomCode(room.code)
      joinRoomMutation.mutate(room.code)
    }
  }

  const handleSignIn = () => {
    if (!pendingJoinCode) return

    signIn.social({
      provider: 'discord',
      callbackURL: `${window.location.origin}/rooms?join=${encodeURIComponent(pendingJoinCode)}`,
    })
  }

  const authPrompt =
    pendingJoinCode !== null ? (
      <Suspense fallback={<ModalLoading />}>
        <LazyJoinRoomAuthModal
          open
          roomCode={pendingJoinCode}
          onOpenChange={(open) => {
            if (!open) setPendingJoinCode(null)
          }}
          onSignIn={handleSignIn}
        />
      </Suspense>
    ) : null

  return { requestJoin, joiningRoomCode, authPrompt }
}

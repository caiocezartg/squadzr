import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useMySquadsCommands } from '@/features/my-squads'
import type { SquadBoardCommands } from '@/features/squad-board'
import { api } from '@/lib/api'
import { getUserFriendlyError } from '@/lib/error-messages'
import { useAppNavigation } from '@/lib/navigation'
import { notifyError } from '@/lib/notify'
import type { PublicSquad } from '@/types'
import { useSquadDetailsCommands } from './squad-details-cache'

interface UseSquadMembershipOptions {
  squadCode: string
  /** Metadata of the Squad whose Membership is being left. */
  squad: PublicSquad | null
  userId: string | undefined
  board: SquadBoardCommands
  /** Releases this tab's channel for the Squad. */
  notifySquadLeave: (squadCode: string) => void
}

/**
 * The Membership workflow of leaving a Squad: release the realtime channel, end the durable Membership over
 * HTTP, drop a hosted Squad from the board and return to the board. Leaving the Lobby instead only changes
 * Presence, because it never runs this workflow.
 */
export function useSquadMembership({
  squadCode,
  squad,
  userId,
  board,
  notifySquadLeave,
}: UseSquadMembershipOptions) {
  const navigateApp = useAppNavigation()
  const t = useTranslations()
  const { refreshMySquads } = useMySquadsCommands()
  const { refreshSquadDetails } = useSquadDetailsCommands()

  const leaveSquad = useCallback(async () => {
    try {
      const isHost = squad?.hostId === userId
      notifySquadLeave(squadCode)
      await api.post(`/api/rooms/${encodeURIComponent(squadCode)}/leave`, {})
      if (isHost && squad) {
        board.removeSquad(squad.id)
      }
      // A member's details are read again, so going back to the Squad within the cache's freshness shows the
      // public view and not a member Lobby the server would refuse. A host's leave deletes the Squad: there
      // is nothing left to correct, and reading it again would only show "not found" until the board opens.
      await Promise.all([
        board.refreshSquads(),
        refreshMySquads(),
        isHost ? Promise.resolve() : refreshSquadDetails(squadCode),
      ])
      navigateApp('/squads')
    } catch (err) {
      notifyError(getUserFriendlyError(err, t, 'leave'))
    }
  }, [
    squad,
    userId,
    squadCode,
    notifySquadLeave,
    board,
    refreshMySquads,
    refreshSquadDetails,
    navigateApp,
    t,
  ])

  return { leaveSquad }
}

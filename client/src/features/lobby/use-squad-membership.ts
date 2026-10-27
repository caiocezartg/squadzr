import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useMySquadsCommands } from '@/features/my-squads'
import type { SquadBoardCommands } from '@/features/squad-board'
import { api } from '@/lib/api'
import { getUserFriendlyError } from '@/lib/error-messages'
import { useAppNavigation } from '@/lib/navigation'
import { notifyError } from '@/lib/notify'
import type { PublicSquad } from '@/types'

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

  const leaveSquad = useCallback(async () => {
    try {
      const isHost = squad?.hostId === userId
      notifySquadLeave(squadCode)
      await api.post(`/api/rooms/${encodeURIComponent(squadCode)}/leave`, {})
      if (isHost && squad) {
        board.removeSquad(squad.id)
      }
      await Promise.all([board.refreshSquads(), refreshMySquads()])
      navigateApp('/squads')
    } catch (err) {
      notifyError(getUserFriendlyError(err, t, 'leave'))
    }
  }, [squad, userId, squadCode, notifySquadLeave, board, refreshMySquads, navigateApp, t])

  return { leaveSquad }
}

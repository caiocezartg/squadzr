import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { joinRoomResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import { getUserFriendlyError } from '@/lib/error-messages'
import { notifyError } from '@/lib/notify'
// The barrels of these capabilities export only commands, so these imports cannot close a cycle back here.
import { useSquadDetailsCommands } from '@/features/lobby'
import { useMySquadsCommands } from '@/features/my-squads'
import { useSquadBoardCommands } from '@/features/squad-board'

interface UseJoinSquadOptions {
  /** The Membership exists and every list that shows it has been read again. */
  onJoined?: (squadCode: string) => void
  /** The join failed; its error is already a toast. */
  onFailed?: () => void
}

/**
 * The join request of a signed-in viewer: the mutation validates the shared response contract and typed
 * application errors become toasts. Before `onJoined` runs, the board, My Squads and the Squad's own
 * details (a Lobby read as a non-member) are read again, so each of them already tells the truth. A read
 * that fails does not undo the join.
 */
export function useJoinSquad({ onJoined, onFailed }: UseJoinSquadOptions = {}) {
  const t = useTranslations()
  const { refreshSquads } = useSquadBoardCommands()
  const { refreshMySquads } = useMySquadsCommands()
  const { refreshSquadDetails } = useSquadDetailsCommands()

  const mutation = useMutation({
    mutationFn: (squadCode: string) =>
      api.post(`/api/rooms/${encodeURIComponent(squadCode)}/join`, {}, joinRoomResponseSchema),
    onSuccess: async (_, squadCode) => {
      // The POST alone decides whether the viewer joined: a list that cannot be read afterwards is not a failed
      // join, so it never reaches `onError` and `onJoined` always runs.
      await Promise.allSettled([refreshSquads(), refreshMySquads(), refreshSquadDetails(squadCode)])
      onJoined?.(squadCode)
    },
    onError: (err) => {
      onFailed?.()
      notifyError(getUserFriendlyError(err, t, 'join'))
    },
  })

  return { join: mutation.mutate, joining: mutation.isPending }
}

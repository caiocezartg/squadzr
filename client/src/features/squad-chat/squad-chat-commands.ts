import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { squadChatQueryKey } from './squad-chat-cache'

export interface SquadChatCommands {
  /**
   * The viewer lost access to a Squad's chat, because their Membership was revoked or the Squad was
   * deleted: the history the cache holds is no longer theirs to read, so it is dropped.
   */
  discardSquadChat: (squadCode: string) => void
}

/**
 * The chat command other capabilities need. The Lobby tears the chat down on a revoked Membership, so the
 * cache is dropped here without the Lobby knowing the chat's query key.
 */
export function useSquadChatCommands(): SquadChatCommands {
  const queryClient = useQueryClient()
  return useMemo(
    () => ({
      discardSquadChat: (squadCode: string) =>
        queryClient.removeQueries({ queryKey: squadChatQueryKey(squadCode) }),
    }),
    [queryClient]
  )
}

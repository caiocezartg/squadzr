import { useCallback, useRef } from 'react'
import { CHAT } from '@squadzr/schemas'
import type { SquadChatChannel } from './use-squad-chat'

/** What sending typing needs of the Lobby's channel: the signal itself and a revoked Membership. */
export type TypingSenderChannel = Pick<SquadChatChannel, 'membershipRevoked' | 'notifyTyping'>

export interface UseTypingSenderOptions {
  /** Only a member signals typing. */
  readonly enabled: boolean
  /** A Ready Squad's chat is read-only: nothing is signalled. */
  readonly isReady: boolean
}

/**
 * Tells the Squad's other members that the viewer is typing. Call the returned function with the composer's
 * text each time it changes: an empty text signals nothing, and a signal goes out at most once per
 * `TYPING_THROTTLE_MS`. A signal sent while the socket is down is lost, which typing can afford.
 */
export function useTypingSender(
  squadCode: string,
  channel: TypingSenderChannel,
  options: UseTypingSenderOptions
): (draft: string) => void {
  const { notifyTyping, membershipRevoked } = channel
  const active = options.enabled && !membershipRevoked && !options.isReady
  const lastSentAtRef = useRef<number | null>(null)
  const code = squadCode.toUpperCase()

  return useCallback(
    (draft: string) => {
      if (!active || draft.trim() === '') return
      const now = Date.now()
      const last = lastSentAtRef.current
      if (last !== null && now - last < CHAT.TYPING_THROTTLE_MS) return
      lastSentAtRef.current = now
      notifyTyping(code)
    },
    [active, code, notifyTyping]
  )
}

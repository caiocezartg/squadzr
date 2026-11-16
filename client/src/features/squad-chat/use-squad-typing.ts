import { useEffect, useMemo, useRef, useState } from 'react'
import { CHAT } from '@squadzr/schemas'
import { useSession } from '@/hooks/use-session'
import type { SquadChatChannel } from './use-squad-chat'

/** A member as the typing footer names them. */
export interface TypingMember {
  readonly id: string
  readonly name: string
}

/** What typing needs of the Lobby's channel: the socket's event registration and a revoked Membership. */
export type SquadTypingChannel = Pick<SquadChatChannel, 'membershipRevoked' | 'on'>

export interface UseSquadTypingOptions {
  /** Only a member reads the chat's live events: the same rule as `useSquadChat`. */
  readonly enabled: boolean
  /** A Ready Squad shows no typing: its chat is read-only. */
  readonly isReady: boolean
  /** The Squad's members, to name who is typing. A typist outside this list has no name to show. */
  readonly members?: readonly TypingMember[]
}

export interface SquadTyping {
  /** Who is typing now, the viewer excluded, for the member tiles. */
  readonly typingIds: ReadonlySet<string>
  /** The same members with their names, in the order they started, for the chat footer. */
  readonly typers: readonly TypingMember[]
}

const NOBODY: readonly string[] = []
const NO_MEMBERS: readonly TypingMember[] = []

/**
 * Who is typing in a Squad, from the `chat_typing` events of its channel. A member counts as typing for
 * `TYPING_TTL_MS` after the last signal, and stops at once when that member's message arrives. The state
 * lives in memory only, and the viewer's own signal is ignored. A Ready Squad, a revoked Membership or a
 * viewer who is not a member show nobody. Hold it where both the members panel and the chat footer can
 * read it.
 */
export function useSquadTyping(
  squadCode: string,
  channel: SquadTypingChannel,
  options: UseSquadTypingOptions
): SquadTyping {
  const { on, membershipRevoked } = channel
  const { enabled, isReady, members = NO_MEMBERS } = options
  const code = squadCode.toUpperCase()
  const active = enabled && !membershipRevoked && !isReady
  const viewerId = useSession()?.user.id ?? null
  // The handler reads it through a ref, so a session refresh never re-registers it.
  const viewerIdRef = useRef(viewerId)
  useEffect(() => {
    viewerIdRef.current = viewerId
  }, [viewerId])
  const [typing, setTyping] = useState<readonly string[]>(NOBODY)

  useEffect(() => {
    if (!active) return
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    function stop(playerId: string): void {
      clearTimeout(timers.get(playerId))
      timers.delete(playerId)
      setTyping((current) => (current.includes(playerId) ? without(current, playerId) : current))
    }

    const offTyping = on('chat_typing', ({ roomCode, playerId }) => {
      if (roomCode.toUpperCase() !== code || playerId === viewerIdRef.current) return
      clearTimeout(timers.get(playerId))
      timers.set(
        playerId,
        setTimeout(() => stop(playerId), CHAT.TYPING_TTL_MS)
      )
      setTyping((current) => (current.includes(playerId) ? current : [...current, playerId]))
    })
    const offMessage = on('chat_message', ({ message }) => {
      if (message.roomCode.toUpperCase() === code) stop(message.author.id)
    })

    return () => {
      offTyping()
      offMessage()
      for (const timer of timers.values()) clearTimeout(timer)
      setTyping(NOBODY)
    }
  }, [active, code, on])

  const ids = active ? typing : NOBODY
  return useMemo(() => {
    const byId = new Map(members.map((member) => [member.id, member]))
    return {
      typingIds: new Set(ids),
      typers: ids.flatMap((id) => byId.get(id) ?? []),
    }
  }, [ids, members])
}

function without(ids: readonly string[], playerId: string): readonly string[] {
  return ids.filter((id) => id !== playerId)
}

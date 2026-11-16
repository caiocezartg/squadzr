import { useCallback, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  chatHistoryResponseSchema,
  chatMessageBodySchema,
  chatMessageSchema,
  type ChatHistoryResponse,
  type ChatMessageDto,
} from '@squadzr/schemas'
import { useSession } from '@/hooks/use-session'
import { api, ApiClientError } from '@/lib/api'
import {
  messagesOf,
  removeMessage,
  squadChatQueryKey,
  upsertMessage,
  type ChatHistoryData,
} from './squad-chat-cache'
import { toSquadChatMessage, type SquadChatMessage } from './squad-chat-message'

export type SquadChatStatus = 'loading' | 'error' | 'ready'

/**
 * What a send came to. A failure carries the text the member typed, so the composer can put it back, and
 * the server's error code when it answered one.
 */
export type SendChatOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false
      /** `invalid`: the body breaks the shared rules. `busy`: another send is still pending. */
      readonly reason: 'invalid' | 'busy' | 'failed'
      readonly text: string
      readonly code: string | null
    }

export interface SquadChat {
  /** `loading` only while the cache holds nothing for this Squad: a warm cache is `ready` at once. */
  readonly status: SquadChatStatus
  /** Oldest first, the viewer's unconfirmed sends included (`pending`). */
  readonly messages: readonly SquadChatMessage[]
  /** A send is waiting for the server, so the composer holds the next one back. */
  readonly isSending: boolean
  /**
   * Sends one message; only one send is pending at a time. The composer should wait for `status` to be
   * `ready`: before the history is cached there is nowhere to show the pending message, so it only appears
   * once the history is read again.
   */
  send: (text: string) => Promise<SendChatOutcome>
  /** Reads the history again after it failed. */
  retry: () => void
}

export interface UseSquadChatOptions {
  /** Only a member reads the chat: the same rule that lets a member join the Lobby's live channel. */
  readonly enabled: boolean
}

function messagesPath(squadCode: string): string {
  return `/api/rooms/${encodeURIComponent(squadCode)}/messages`
}

/**
 * Shows the viewer's message in the history before the server answers. The pending read of the history
 * is cancelled first, so an older answer cannot land on top of it. Returns false when the cache holds no
 * history yet, which is when nothing can be shown.
 */
async function showOptimistically(
  queryClient: QueryClient,
  squadCode: string,
  message: ChatMessageDto
): Promise<boolean> {
  const key = squadChatQueryKey(squadCode)
  await queryClient.cancelQueries({ queryKey: key })
  if (queryClient.getQueryData(key) === undefined) return false

  queryClient.setQueryData<ChatHistoryData>(key, (data) => data && upsertMessage(data, message))
  return true
}

/** Puts the server's message where the optimistic one was, or reads the history when none was shown. */
async function confirm(
  queryClient: QueryClient,
  squadCode: string,
  stored: ChatMessageDto
): Promise<void> {
  const key = squadChatQueryKey(squadCode)
  await queryClient.cancelQueries({ queryKey: key })
  if (queryClient.getQueryData(key) === undefined) {
    await queryClient.invalidateQueries({ queryKey: key })
    return
  }
  queryClient.setQueryData<ChatHistoryData>(key, (data) => data && upsertMessage(data, stored))
}

function discard(queryClient: QueryClient, squadCode: string, id: string): void {
  queryClient.setQueryData<ChatHistoryData>(
    squadChatQueryKey(squadCode),
    (data) => data && removeMessage(data, id)
  )
}

/**
 * The data side of a Squad's chat: the latest page of its history, and the viewer's sends. A send shows
 * at once as a pending message under an id the client generates, which the server stores as given, so the
 * server's answer replaces it instead of adding a second one. A failed send takes its message back out and
 * hands the text back to the caller. Hold it above the chat window, so a send survives the window closing.
 */
export function useSquadChat(squadCode: string, options: UseSquadChatOptions): SquadChat {
  const queryClient = useQueryClient()
  const viewer = useSession()?.user ?? null
  const code = squadCode.toUpperCase()
  // The id of the viewer's one unconfirmed message. After a failure it stays, harmless, until the next
  // send: the message is already out of the history, and clearing it earlier than the history's own
  // update would draw the failed message as confirmed for a frame.
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  // The state above trails a render behind; a second send in the same tick must still see the first.
  const sendingRef = useRef(false)

  const history = useInfiniteQuery<
    ChatHistoryResponse,
    Error,
    ChatHistoryData,
    ReturnType<typeof squadChatQueryKey>,
    string | undefined
  >({
    queryKey: squadChatQueryKey(code),
    queryFn: ({ signal }) => api.get(messagesPath(code), chatHistoryResponseSchema, signal),
    // The history pages newest first; only the latest page is read so far.
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined,
    enabled: options.enabled,
  })

  const messages = useMemo<readonly SquadChatMessage[]>(
    () =>
      history.data
        ? messagesOf(history.data).map((message) => ({
            ...toSquadChatMessage(message),
            pending: message.id === pendingId,
          }))
        : [],
    [history.data, pendingId]
  )

  const send = useCallback(
    async (text: string): Promise<SendChatOutcome> => {
      const body = chatMessageBodySchema.safeParse(text)
      if (!body.success || !viewer) return { ok: false, reason: 'invalid', text, code: null }
      if (sendingRef.current) return { ok: false, reason: 'busy', text, code: null }

      sendingRef.current = true
      const id = crypto.randomUUID()
      const author = { id: viewer.id, name: viewer.name, image: viewer.image ?? null }
      const draft: ChatMessageDto = {
        id,
        roomCode: code,
        body: body.data,
        createdAt: new Date().toISOString(),
        author,
      }
      setPendingId(id)
      setIsSending(true)

      try {
        await showOptimistically(queryClient, code, draft)
        const stored = await api.post(
          messagesPath(code),
          { id, body: body.data },
          chatMessageSchema
        )
        await confirm(queryClient, code, stored)
        setPendingId(null)
        return { ok: true }
      } catch (error) {
        discard(queryClient, code, id)
        const errorCode = error instanceof ApiClientError ? (error.code ?? null) : null
        return { ok: false, reason: 'failed', text, code: errorCode }
      } finally {
        sendingRef.current = false
        setIsSending(false)
      }
    },
    [code, queryClient, viewer]
  )

  const retry = useCallback(() => {
    void history.refetch()
  }, [history])

  const status: SquadChatStatus = history.data ? 'ready' : history.isError ? 'error' : 'loading'

  return { status, messages, isSending, send, retry }
}

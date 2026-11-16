import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import type { RealtimeEventSubscribe, RealtimeStatus } from '@/lib/ws-client'
import {
  appendOlderPage,
  messagesOf,
  oldestStoredId,
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

/**
 * What the chat needs of the Lobby's realtime channel: the connection status, to read the history again
 * after a reconnect, whether the Membership was revoked, and the socket's event registration.
 */
export interface SquadChatChannel {
  readonly status: RealtimeStatus
  readonly membershipRevoked: boolean
  readonly on: RealtimeEventSubscribe
  /** Signals that the viewer is typing in this Squad; a signal sent while the socket is down is lost. */
  readonly notifyTyping: (squadCode: string) => void
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
  /** Older messages exist beyond the ones held. */
  readonly hasMore: boolean
  /** An older page is being read. */
  readonly isFetchingOlder: boolean
  /** The last older page could not be read; the reader can ask for it again. */
  readonly olderFailed: boolean
  /** Reads the page before the oldest message held, and adds it at the top. A no-op while one is being read. */
  fetchOlder: () => Promise<void>
  /**
   * Messages from other members that arrived live while the window was closed. It lives in memory only and
   * goes back to zero when the window opens.
   */
  readonly unreadCount: number
}

export interface UseSquadChatOptions {
  /** Only a member reads the chat: the same rule that lets a member join the Lobby's live channel. */
  readonly enabled: boolean
  /** The chat window is open: what arrives meanwhile is read at once, not unread. */
  readonly open: boolean
}

function messagesPath(squadCode: string, before?: string): string {
  const path = `/api/rooms/${encodeURIComponent(squadCode)}/messages`
  return before ? `${path}?before=${encodeURIComponent(before)}` : path
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
 * Reads every page of the history again, so what was missed converges. A read already running is stopped
 * first: one that has no history yet would otherwise be reused, and could not hold what arrived since.
 */
function readHistoryAgain(queryClient: QueryClient, squadCode: string): void {
  const queryKey = squadChatQueryKey(squadCode)
  void queryClient
    .cancelQueries({ queryKey })
    .then(() => queryClient.invalidateQueries({ queryKey }))
}

interface ConvergeOptions {
  readonly code: string
  readonly enabled: boolean
  readonly channel: SquadChatChannel
  readonly readAgain: () => void
}

/**
 * Reads the history again once the socket has joined the Squad's channel, for the first time on this page
 * and after every reconnect. The history may have been read before the socket was in the channel, or while
 * it was down, so a message sent in between reached neither. The Squad's snapshot, not the socket opening,
 * marks the join: the server adds the socket to the channel before it answers with the snapshot, so nothing
 * stored after this read is missed. Later snapshots, which every Membership change sends, read nothing.
 */
function useConvergeOnSnapshot({ code, enabled, channel, readAgain }: ConvergeOptions): void {
  const { on, status } = channel
  const convergedRef = useRef(false)

  useEffect(() => {
    if (status !== 'open') convergedRef.current = false
  }, [status])

  useEffect(() => {
    if (!enabled) return
    return on('room_snapshot', ({ room }) => {
      if (room.code.toUpperCase() !== code || convergedRef.current) return
      convergedRef.current = true
      readAgain()
    })
  }, [code, enabled, on, readAgain])
}

interface LiveChatOptions {
  readonly code: string
  readonly channel: SquadChatChannel
  readonly enabled: boolean
  readonly open: boolean
  /** A send is pending: a read of the history would drop its message, so it waits for the send. */
  readonly isSendPending: () => boolean
}

/**
 * The live side of a Squad's chat: `chat_message` events merged into the history, the history read again
 * after a reconnect and the unread count while the window is closed. Returns the unread count and a way
 * to read the history once a pending send is done.
 */
function useLiveChat(options: LiveChatOptions) {
  const { code, channel, enabled, open, isSendPending } = options
  const { on } = channel
  const queryClient = useQueryClient()
  const viewerId = useSession()?.user.id ?? null
  const [unreadCount, setUnreadCount] = useState(0)
  // The handler reads these through refs, so the window opening never re-registers it.
  const openRef = useRef(open)
  const viewerIdRef = useRef(viewerId)
  const readAfterSendRef = useRef(false)

  useEffect(() => {
    openRef.current = open
    viewerIdRef.current = viewerId
    if (open) setUnreadCount(0)
  }, [open, viewerId])

  const readAgain = useCallback(() => {
    if (isSendPending()) readAfterSendRef.current = true
    else readHistoryAgain(queryClient, code)
  }, [code, isSendPending, queryClient])

  /** Reads what a reconnect or a live message left behind, now that no send is pending. */
  const flushPendingRead = useCallback(() => {
    if (!readAfterSendRef.current) return
    readAfterSendRef.current = false
    readHistoryAgain(queryClient, code)
  }, [code, queryClient])

  useEffect(() => {
    if (!enabled) return
    const key = squadChatQueryKey(code)

    const offMessage = on('chat_message', ({ message }) => {
      if (message.roomCode.toUpperCase() !== code) return
      const data = queryClient.getQueryData<ChatHistoryData>(key)
      const known = data ? messagesOf(data).some((held) => held.id === message.id) : false
      if (!data) {
        readAgain()
      } else {
        queryClient.setQueryData<ChatHistoryData>(
          key,
          (current) => current && upsertMessage(current, message)
        )
        // A read that started before the message was stored cannot hold it, and would replace this merge.
        if (queryClient.isFetching({ queryKey: key }) > 0) readAgain()
      }
      if (!known && message.author.id !== viewerIdRef.current && !openRef.current) {
        setUnreadCount((count) => count + 1)
      }
    })
    return offMessage
  }, [code, enabled, on, queryClient, readAgain])

  useConvergeOnSnapshot({ code, enabled, channel, readAgain })

  return { unreadCount, flushPendingRead }
}

/**
 * The older pages of the history, read on demand from the oldest stored message. The viewer's pending
 * message is skipped as a cursor: it carries the client's clock, which may date it before every stored one.
 */
function useOlderPages(code: string, data: ChatHistoryData | undefined, pendingId: string | null) {
  const queryClient = useQueryClient()
  const [isFetchingOlder, setIsFetchingOlder] = useState(false)
  const [olderFailed, setOlderFailed] = useState(false)
  const fetchingOlderRef = useRef(false)
  const hasMore = data?.pages.at(-1)?.hasMore ?? false
  const oldestId = data ? oldestStoredId(data, pendingId) : undefined
  // The page lands after the send may have settled, so it checks the history against the id pending then.
  const pendingIdRef = useRef(pendingId)
  useEffect(() => {
    pendingIdRef.current = pendingId
  }, [pendingId])

  const fetchOlder = useCallback(async () => {
    if (!hasMore || !oldestId || fetchingOlderRef.current) return
    fetchingOlderRef.current = true
    setIsFetchingOlder(true)
    setOlderFailed(false)
    try {
      // Read outside the infinite query: it would rebuild the pages from the ones it held when this read
      // started, and drop the live messages merged since.
      const page = await api.get(messagesPath(code, oldestId), chatHistoryResponseSchema)
      queryClient.setQueryData<ChatHistoryData>(
        squadChatQueryKey(code),
        (current) => current && appendOlderPage(current, page, oldestId, pendingIdRef.current)
      )
    } catch {
      // The history stays as it was, with older messages still to read, and the reader is offered a retry.
      setOlderFailed(true)
    } finally {
      fetchingOlderRef.current = false
      setIsFetchingOlder(false)
    }
  }, [code, hasMore, oldestId, queryClient])

  return { hasMore, isFetchingOlder, olderFailed, fetchOlder }
}

/**
 * The data side of a Squad's chat: its history, newest page first with older pages on demand, the live
 * messages of other members, and the viewer's sends. A send shows at once as a pending message under an id
 * the client generates, which the server stores as given, so the server's echo and its answer both replace
 * it instead of adding a second one, whichever comes first. A failed send takes its message back out and
 * hands the text back to the caller. Hold it above the chat window, so a send survives the window closing.
 */
export function useSquadChat(
  squadCode: string,
  channel: SquadChatChannel,
  options: UseSquadChatOptions
): SquadChat {
  const queryClient = useQueryClient()
  const viewer = useSession()?.user ?? null
  const code = squadCode.toUpperCase()
  // A revoked Membership no longer authorizes the history: the Lobby drops the cache, and nothing reads it.
  const active = options.enabled && !channel.membershipRevoked
  // The id of the viewer's one unconfirmed message. A failure clears it in the same update that takes the
  // message out of the history, so the message is never drawn as confirmed.
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  // The state above trails a render behind; a second send in the same tick must still see the first.
  const sendingRef = useRef(false)
  // The last failed send. Its answer may only have been lost, so sending the same text again reuses its id,
  // and the server, idempotent on the id, stores it at most once.
  const failedRef = useRef<{ readonly body: string; readonly id: string } | null>(null)

  const isSendPending = useCallback(() => sendingRef.current, [])
  const { unreadCount, flushPendingRead } = useLiveChat({
    code,
    channel,
    enabled: active,
    open: options.open,
    isSendPending,
  })

  const history = useInfiniteQuery<
    ChatHistoryResponse,
    Error,
    ChatHistoryData,
    ReturnType<typeof squadChatQueryKey>,
    string | undefined
  >({
    queryKey: squadChatQueryKey(code),
    queryFn: ({ signal, pageParam }) =>
      api.get(messagesPath(code, pageParam), chatHistoryResponseSchema, signal),
    // The history pages newest first; an older page starts before the oldest message the last page holds.
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.items[0]?.id : undefined),
    enabled: active,
    // A Lobby opened again within the cache's freshness missed what was sent while it was away, and the
    // events that carried it. The cached history shows at once while this read catches it up.
    refetchOnMount: 'always',
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
      const failed = failedRef.current
      const id = failed?.body === body.data ? failed.id : crypto.randomUUID()
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
        failedRef.current = null
        setPendingId(null)
        return { ok: true }
      } catch (error) {
        discard(queryClient, code, id)
        setPendingId(null)
        // Only an answer that may have been lost keeps the id: the server refused anything below 500.
        const refused = error instanceof ApiClientError && error.status < 500
        failedRef.current = refused ? null : { body: body.data, id }
        const errorCode = error instanceof ApiClientError ? (error.code ?? null) : null
        return { ok: false, reason: 'failed', text, code: errorCode }
      } finally {
        sendingRef.current = false
        setIsSending(false)
        flushPendingRead()
      }
    },
    [code, flushPendingRead, queryClient, viewer]
  )

  const retry = useCallback(() => {
    void history.refetch()
  }, [history])

  const { hasMore, isFetchingOlder, olderFailed, fetchOlder } = useOlderPages(
    code,
    history.data,
    pendingId
  )

  const status: SquadChatStatus = history.data ? 'ready' : history.isError ? 'error' : 'loading'

  return {
    status,
    messages,
    isSending,
    send,
    retry,
    hasMore,
    isFetchingOlder,
    olderFailed,
    fetchOlder,
    unreadCount,
  }
}

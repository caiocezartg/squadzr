'use client'

import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ArrowDown, Loader2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { Button } from '@/components/ds/button'
import { VIEWER_TIME_ZONE } from '@/hooks/use-time-ago'
import { cn } from '@/lib/utils'
import { groupMessages, type DayDivider, type MessageGroup } from '../group-messages'
import { linkifyText } from '../linkify-text'
import type { SquadChatMessage } from '../squad-chat-message'
import type { SquadChatStatus } from '../use-squad-chat'

/** How close to the end the reader must be, in px, for a new message to keep the list at the bottom. */
const STICK_THRESHOLD = 32
/** How close to the start the reader must be, in px, for the older page to be read. */
const OLDER_THRESHOLD = 64

interface OlderHistory {
  /** Older messages exist beyond the ones held. */
  readonly hasMore: boolean
  /** An older page is being read. */
  readonly isFetchingOlder: boolean
  /** Reads the page before the oldest message held. */
  readonly onReachTop: () => void
}

interface ChatMessagesProps extends OlderHistory {
  readonly status: SquadChatStatus
  readonly messages: readonly SquadChatMessage[]
  readonly viewerId: string
  readonly onRetry: () => void
}

/**
 * The chat's history: the skeleton while nothing is cached, the error with a retry, the empty state, or
 * the messages in day and author groups. It opens at the bottom and stays there when a message arrives
 * while the reader is at the bottom, or when the viewer sends; otherwise a pill offers the way down.
 * Reaching the top reads the older page, which lands above without moving what the reader sees.
 */
export function ChatMessages({ status, messages, viewerId, onRetry, ...older }: ChatMessagesProps) {
  const t = useTranslations('chat')

  if (status === 'loading') return <ChatSkeleton label={t('loading')} />

  if (status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p role="alert" className="text-text-3 text-[14px] font-semibold">
          {t('loadFailed')}
        </p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('retry')}
        </Button>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-muted text-[14px] leading-snug font-semibold">{t('empty')}</p>
      </div>
    )
  }

  return <MessageList messages={messages} viewerId={viewerId} {...older} />
}

interface MessageListProps extends OlderHistory {
  readonly messages: readonly SquadChatMessage[]
  readonly viewerId: string
}

function MessageList({ messages, viewerId, ...older }: MessageListProps) {
  const t = useTranslations('chat')
  const entries = useMemo(
    () => groupMessages(messages, { viewerId, timeZone: VIEWER_TIME_ZONE }),
    [messages, viewerId]
  )
  const listRef = useRef<HTMLDivElement>(null)
  const { showPill, jumpToBottom, handleScroll } = useChatScroll(listRef, messages, viewerId, older)

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* The browser's own scroll anchoring would add to the position kept when older messages land. */}
      <div
        ref={listRef}
        role="log"
        aria-label={t('messages')}
        tabIndex={0}
        onScroll={handleScroll}
        className="scrollbar-thin focus-visible:outline-mint flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 py-4 [overflow-anchor:none] focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        {entries.map((entry) =>
          entry.kind === 'day' ? (
            <DayLine key={entry.key} divider={entry} />
          ) : (
            <Group key={entry.key} group={entry} />
          )
        )}
      </div>
      {/* Both float over the list, so neither changes its height and moves what the reader sees. */}
      {older.isFetchingOlder && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          <span
            role="status"
            aria-label={t('loadingOlder')}
            className="bg-raised-2 text-text-3 flex items-center gap-1.5 px-2.5 py-1 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.9)]"
          >
            <Loader2 aria-hidden="true" className="size-3 animate-spin" strokeWidth={2.6} />
            <span aria-hidden="true" className="type-label text-[10px]">
              {t('loadingOlder')}
            </span>
          </span>
        </div>
      )}
      {showPill && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <button
            type="button"
            onClick={jumpToBottom}
            className="press animate-menu-in bg-mint text-mint-ink hover-fine:bg-mint-hover focus-visible:outline-text pointer-events-auto flex h-9 items-center gap-1.5 px-3.5 shadow-[0_12px_32px_-12px_rgba(0,255,162,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ArrowDown aria-hidden="true" className="size-3.5" strokeWidth={2.8} />
            <span className="type-label text-[11px]">{t('newMessages')}</span>
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * The list's scroll position. It opens at the bottom and follows a new message while the reader is at the
 * bottom, or when it is the viewer's own; otherwise it stays put and asks for the pill. Older messages that
 * land above move the position by their height, so the reader sees the same rows. Every move is a jump
 * without a scroll animation: a send is keyboard driven and happens many times in a row.
 */
function useChatScroll(
  listRef: RefObject<HTMLDivElement | null>,
  messages: readonly SquadChatMessage[],
  viewerId: string,
  { hasMore, isFetchingOlder, onReachTop }: OlderHistory
) {
  // Starts true, so the list opens at the bottom.
  const atBottomRef = useRef(true)
  const [showPill, setShowPill] = useState(false)
  // What the list showed when last drawn: its ends, how many messages, and where its first row sat.
  const drawnRef = useRef<{
    firstId?: string
    firstTop: number
    lastId?: string
    count: number
  } | null>(null)
  const firstId = messages[0]?.id
  const count = messages.length
  const last = messages.at(-1)
  const lastId = last?.id
  const lastAuthorId = last?.author.id

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const drawn = drawnRef.current
    if (drawn?.firstId && firstId !== drawn.firstId) {
      // Older rows landed above: move by how far the row that was first went down, so the reader sees
      // the same rows whatever else changed in the list since.
      const row = list.querySelector<HTMLElement>(`[data-message-id="${drawn.firstId}"]`)
      if (row) list.scrollTop += topInList(list, row) - drawn.firstTop
    }
    // A message also lands above the last one when its sender's clock is behind the viewer's.
    const arrived =
      !drawn || lastId !== drawn.lastId || (firstId === drawn.firstId && count > drawn.count)
    if (arrived) {
      if (atBottomRef.current || lastAuthorId === viewerId) {
        list.scrollTop = list.scrollHeight
        atBottomRef.current = true
        setShowPill(false)
      } else if (drawn && count >= drawn.count) {
        // Not when a message went away: a failed send taken back out leaves an older one last.
        setShowPill(true)
      }
    }
    drawnRef.current = {
      firstId,
      firstTop: topOfFirstRow(list),
      lastId,
      count,
    }
  }, [firstId, count, lastId, lastAuthorId, listRef, viewerId])

  const handleScroll = () => {
    const list = listRef.current
    if (!list) return
    // Measured again here, where the window is settled: drawn while it opened, the row sat under its scale.
    if (drawnRef.current) drawnRef.current.firstTop = topOfFirstRow(list)
    atBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight <= STICK_THRESHOLD
    if (atBottomRef.current) setShowPill(false)
    if (list.scrollTop <= OLDER_THRESHOLD && hasMore && !isFetchingOlder) onReachTop()
  }

  const jumpToBottom = () => {
    const list = listRef.current
    if (!list) return
    list.scrollTop = list.scrollHeight
    atBottomRef.current = true
    setShowPill(false)
    // The pill goes away under the pointer; focus stays in the chat instead of falling to the page.
    list.focus({ preventScroll: true })
  }

  return { showPill, jumpToBottom, handleScroll }
}

/** A row's distance from the top of the list's content, unrounded and whatever the scroll position. */
function topInList(list: HTMLElement, row: HTMLElement): number {
  return row.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
}

function topOfFirstRow(list: HTMLElement): number {
  const row = list.querySelector<HTMLElement>('[data-message-id]')
  return row ? topInList(list, row) : 0
}

function DayLine({ divider }: { readonly divider: DayDivider }) {
  const t = useTranslations('chat')
  const format = useFormatter()
  // The day key is already in the viewer's zone; reading it at UTC midnight keeps the same date.
  const label = divider.isToday
    ? t('today')
    : format.dateTime(new Date(`${divider.dayKey}T00:00:00Z`), {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })

  return (
    <div role="separator" aria-label={label} className="flex items-center gap-3">
      <span aria-hidden="true" className="bg-line h-px flex-1" />
      <span aria-hidden="true" className="type-label text-faint text-[10px]">
        {label}
      </span>
      <span aria-hidden="true" className="bg-line h-px flex-1" />
    </div>
  )
}

function useMessageTime() {
  const format = useFormatter()
  return (createdAt: string) =>
    format.dateTime(new Date(createdAt), {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: VIEWER_TIME_ZONE,
    })
}

function Group({ group }: { readonly group: MessageGroup }) {
  const time = useMessageTime()
  const first = group.messages[0]
  if (!first) return null

  return (
    <div
      data-own={group.own || undefined}
      className={cn('flex items-start gap-2.5', group.own && 'flex-row-reverse')}
    >
      <Avatar
        size={28}
        playerId={group.author.id}
        name={group.author.name}
        image={group.author.image}
      />
      <div className={cn('flex min-w-0 flex-1 flex-col gap-1', group.own && 'items-end')}>
        <p className={cn('flex items-baseline gap-2', group.own && 'flex-row-reverse')}>
          <span className="text-text truncate text-[13px] font-bold">{group.author.name}</span>
          <time dateTime={first.createdAt} className="type-code text-faint shrink-0 text-[10px]">
            {time(first.createdAt)}
          </time>
        </p>
        <ul className={cn('flex max-w-[85%] flex-col gap-1', group.own && 'items-end')}>
          {group.messages.map((message) => (
            <Bubble key={message.id} message={message} own={group.own} />
          ))}
        </ul>
      </div>
    </div>
  )
}

function Bubble({ message, own }: { readonly message: SquadChatMessage; readonly own: boolean }) {
  const t = useTranslations('chat')

  return (
    <li
      data-message-id={message.id}
      aria-busy={message.pending || undefined}
      className={cn(
        'text-text-2 px-3 py-2 text-[14px] leading-snug font-medium [overflow-wrap:anywhere] whitespace-pre-wrap',
        'transition-opacity duration-200 ease-out',
        own ? 'bg-mint/10 text-text shadow-[inset_-2px_0_0_var(--color-mint)]' : 'bg-raised',
        message.pending && 'opacity-55'
      )}
    >
      <MessageBody body={message.body} />
      {message.pending && <span className="sr-only"> ({t('sending')})</span>}
    </li>
  )
}

/** The body as plain text, its links as anchors that open in a new tab. Never rendered as HTML. */
function MessageBody({ body }: { readonly body: string }) {
  const segments = useMemo(() => linkifyText(body), [body])

  return segments.map((segment, index) =>
    segment.type === 'link' ? (
      <a
        key={index}
        href={segment.href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        className="text-mint hover-fine:text-mint-hover underline decoration-1 underline-offset-2"
      >
        {segment.text}
      </a>
    ) : (
      <span key={index}>{segment.text}</span>
    )
  )
}

/** Placeholder rows, shown only while the cache holds no history for this Squad. */
function ChatSkeleton({ label }: { readonly label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      data-testid="chat-skeleton"
      className="flex flex-1 flex-col justify-end gap-4 px-4 py-4"
    >
      {[0.62, 0.4, 0.7].map((width, index) => {
        const own = index === 1
        return (
          <div
            key={index}
            aria-hidden="true"
            className={cn('flex items-start gap-2.5', own && 'flex-row-reverse')}
          >
            <span className="bg-track size-7 shrink-0 animate-pulse rounded-full" />
            <span
              className={cn('bg-track h-9 animate-pulse', own && 'bg-mint/10')}
              style={{ width: `${width * 100}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

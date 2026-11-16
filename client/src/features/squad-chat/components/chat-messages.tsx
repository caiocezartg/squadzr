'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
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

interface ChatMessagesProps {
  readonly status: SquadChatStatus
  readonly messages: readonly SquadChatMessage[]
  readonly viewerId: string
  readonly onRetry: () => void
}

/**
 * The chat's history: the skeleton while nothing is cached, the error with a retry, the empty state, or
 * the messages in day and author groups. It opens at the bottom and stays there when a message arrives
 * while the reader is at the bottom, or when the viewer sends.
 */
export function ChatMessages({ status, messages, viewerId, onRetry }: ChatMessagesProps) {
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

  return <MessageList messages={messages} viewerId={viewerId} label={t('messages')} />
}

function MessageList({
  messages,
  viewerId,
  label,
}: {
  readonly messages: readonly SquadChatMessage[]
  readonly viewerId: string
  readonly label: string
}) {
  const entries = useMemo(
    () => groupMessages(messages, { viewerId, timeZone: VIEWER_TIME_ZONE }),
    [messages, viewerId]
  )
  const listRef = useRef<HTMLDivElement>(null)
  // Starts true, so the list opens at the bottom.
  const atBottomRef = useRef(true)
  const last = messages.at(-1)

  // Jumps without a scroll animation: a send is keyboard driven and happens many times in a row.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    if (atBottomRef.current || last?.author.id === viewerId) {
      list.scrollTop = list.scrollHeight
      atBottomRef.current = true
    }
  }, [last?.id, last?.author.id, viewerId])

  const handleScroll = () => {
    const list = listRef.current
    if (!list) return
    atBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight <= STICK_THRESHOLD
  }

  return (
    <div
      ref={listRef}
      role="log"
      aria-label={label}
      tabIndex={0}
      onScroll={handleScroll}
      className="scrollbar-thin focus-visible:outline-mint flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 py-4 focus-visible:outline-2 focus-visible:-outline-offset-2"
    >
      {entries.map((entry) =>
        entry.kind === 'day' ? (
          <DayLine key={entry.key} divider={entry} />
        ) : (
          <Group key={entry.key} group={entry} />
        )
      )}
    </div>
  )
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
  const t = useTranslations('chat')
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
          <span className="text-text truncate text-[13px] font-bold">
            {group.own ? t('you') : group.author.name}
          </span>
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

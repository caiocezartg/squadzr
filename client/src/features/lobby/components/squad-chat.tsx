'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { SendHorizontal } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { CHAT_MESSAGE_MAX_LENGTH, type ChatMessageDto } from '@squadzr/schemas/ws'
import { Avatar } from '@/components/ds/avatar'
import { Button } from '@/components/ds/button'
import { cn } from '@/lib/utils'

/** Messages of one author this close together read as one group, under one name. */
const GROUP_WINDOW_MS = 5 * 60_000
/** How close to the bottom the list must be for a new message to scroll it. */
const STICK_TO_BOTTOM_PX = 80

interface SquadChatProps {
  readonly messages: readonly ChatMessageDto[]
  readonly viewerId: string
  /** The channel is open and joined, so a message can be sent. */
  readonly canSend: boolean
  readonly onSend: (body: string) => void
}

/**
 * The Squad's chat, under the invite: the latest messages, oldest first, and the field to write. A message
 * shows once the server sends it back to the channel, so the list is always what every member sees.
 */
export function SquadChat({ messages, viewerId, canSend, onSend }: SquadChatProps) {
  const t = useTranslations('ds.chat')
  const headingId = useId()
  const listRef = useStickToBottom(messages, viewerId)

  return (
    <section aria-labelledby={headingId} className="bg-panel flex flex-col">
      <h2
        id={headingId}
        className="font-display px-4.5 pt-4.5 text-[34px] leading-none font-black uppercase sm:px-5 sm:pt-5"
      >
        {t('title')}
      </h2>

      <div
        ref={listRef}
        role="log"
        aria-label={t('messages')}
        className="mt-3.5 flex max-h-90 min-h-40 flex-col gap-0.5 overflow-y-auto px-4.5 pb-2 sm:px-5"
      >
        {messages.length === 0 ? (
          <p className="text-text-3 m-auto max-w-64 py-6 text-center text-[14px] leading-snug font-semibold">
            {t('empty')}
          </p>
        ) : (
          messages.map((message, index) => (
            <ChatLine
              key={message.id}
              message={message}
              grouped={continuesGroup(messages[index - 1], message)}
              own={message.authorId === viewerId}
            />
          ))
        )}
      </div>

      <ChatComposer canSend={canSend} onSend={onSend} />
    </section>
  )
}

/** Whether a message follows the previous one of the same author closely enough to skip its header. */
function continuesGroup(previous: ChatMessageDto | undefined, message: ChatMessageDto): boolean {
  if (!previous || previous.authorId !== message.authorId) return false
  return Date.parse(message.sentAt) - Date.parse(previous.sentAt) < GROUP_WINDOW_MS
}

/**
 * Keeps the list at its bottom when a message arrives, if the viewer was already reading there or wrote it:
 * someone scrolled up to read is not pulled down.
 */
function useStickToBottom(messages: readonly ChatMessageDto[], viewerId: string) {
  const listRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const last = messages.at(-1)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const onScroll = () => {
      atBottomRef.current =
        list.scrollHeight - list.scrollTop - list.clientHeight < STICK_TO_BOTTOM_PX
    }
    list.addEventListener('scroll', onScroll, { passive: true })
    return () => list.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list || !last) return
    if (atBottomRef.current || last.authorId === viewerId) list.scrollTop = list.scrollHeight
  }, [last, viewerId])

  return listRef
}

interface ChatLineProps {
  readonly message: ChatMessageDto
  /** Follows the same author's previous message: no avatar or name again. */
  readonly grouped: boolean
  readonly own: boolean
}

function ChatLine({ message, grouped, own }: ChatLineProps) {
  const t = useTranslations('ds.chat')
  const locale = useLocale()
  // In the viewer's own time zone: messages only ever arrive over the socket, so the server never renders one.
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
    new Date(message.sentAt)
  )

  return (
    <article className={cn('flex gap-3', !grouped && 'mt-2.5 first:mt-0')}>
      <div className="w-7 shrink-0">
        {!grouped && (
          <Avatar
            size={28}
            playerId={message.authorId}
            name={message.authorName}
            image={message.authorImage}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <p className="flex items-baseline gap-2">
            <span className={cn('truncate text-[13px] font-bold', own ? 'text-mint' : 'text-text')}>
              {message.authorName}
              {own && <span className="sr-only"> ({t('you')})</span>}
            </span>
            <time dateTime={message.sentAt} className="font-mono text-muted shrink-0 text-[11px]">
              {time}
            </time>
          </p>
        )}
        <p className="text-text-2 text-[14px] leading-snug font-medium break-words whitespace-pre-wrap">
          {message.body}
        </p>
      </div>
    </article>
  )
}

interface ChatComposerProps {
  readonly canSend: boolean
  readonly onSend: (body: string) => void
}

/** The field and its send button. Enter sends; a message that is only spaces is not sent. */
function ChatComposer({ canSend, onSend }: ChatComposerProps) {
  const t = useTranslations('ds.chat')
  const inputId = useId()
  const [draft, setDraft] = useState('')
  const body = draft.trim()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSend || body.length === 0) return
    onSend(body)
    setDraft('')
  }

  return (
    <form
      onSubmit={submit}
      className="border-line flex items-center gap-2 border-t p-3 sm:px-5 sm:py-3.5"
    >
      <label htmlFor={inputId} className="sr-only">
        {t('label')}
      </label>
      <input
        id={inputId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={CHAT_MESSAGE_MAX_LENGTH}
        autoComplete="off"
        placeholder={canSend ? t('placeholder') : t('connecting')}
        disabled={!canSend}
        className="text-text placeholder:text-faint min-h-11 min-w-0 flex-1 bg-[#0c0d10] px-3.5 text-[15px] font-medium shadow-[inset_0_0_0_1.5px_var(--color-track)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-mint)] disabled:opacity-60"
      />
      <Button
        type="submit"
        aria-label={t('send')}
        disabled={!canSend || body.length === 0}
        icon={<SendHorizontal />}
        className="min-h-11"
      />
    </form>
  )
}

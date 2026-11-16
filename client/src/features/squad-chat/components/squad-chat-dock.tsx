'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSession } from '@/hooks/use-session'
import { useSquadChat, type SquadChatChannel } from '../use-squad-chat'
import type { TypingMember } from '../use-squad-typing'
import { useTypingSender } from '../use-typing-sender'
import { ChatComposer } from './chat-composer'
import { ChatMessages } from './chat-messages'
import { ChatTyping } from './chat-typing'
import { ChatWindow } from './chat-window'

/** The badge shows counts above this one as `99+`; the label read aloud keeps the exact count. */
const UNREAD_CAP = 99

export interface SquadChatDockProps {
  readonly squadCode: string
  /** The Lobby's realtime channel: live messages, the reconnect and a revoked Membership. */
  readonly channel: SquadChatChannel
  /** How many members the Squad has, for the window's header. */
  readonly memberCount: number
  /** Only a member reads and writes the chat. */
  readonly enabled: boolean
  /** The Squad is complete: its chat is read-only, so the composer signals no typing. */
  readonly isReady: boolean
  /** Who is typing, from the Lobby's `useSquadTyping`, for the window's footer. */
  readonly typers: readonly TypingMember[]
}

/**
 * The Squad Chat of the Lobby: the launcher in the bottom-right corner and the window it opens. The
 * chat's data and the draft live here, above the window, so a pending send and an unsent draft survive
 * the window closing. The Lobby reserves room at its foot, so the launcher never covers its actions.
 */
export function SquadChatDock({
  squadCode,
  channel,
  memberCount,
  enabled,
  isReady,
  typers,
}: SquadChatDockProps) {
  const t = useTranslations('chat')
  const viewerId = useSession()?.user.id ?? ''
  const [open, setOpen] = useState(false)
  const chat = useSquadChat(squadCode, channel, { enabled, open, isReady })
  const [draft, setDraft] = useState('')
  const [failed, setFailed] = useState(false)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const unreadId = useId()
  const { send, readOnly } = chat
  const signalTyping = useTypingSender(squadCode, channel, { enabled, isReady: readOnly })

  // A complete Squad has nowhere to send an unsent draft: it is dropped, not kept for later.
  useEffect(() => {
    if (readOnly) setDraft('')
  }, [readOnly])

  const handleDraftChange = useCallback(
    (next: string) => {
      setDraft(next)
      setFailed(false)
      signalTyping(next)
    },
    [signalTyping]
  )

  const handleSend = useCallback(async () => {
    const text = draft
    setDraft('')
    setFailed(false)
    const outcome = await send(text)
    if (outcome.ok) return
    // A complete Squad drops the text; otherwise whatever was typed while the send was pending stays
    // after the text put back.
    if (outcome.reason !== 'read_only') {
      setDraft((current) => (current === '' ? outcome.text : `${outcome.text}\n${current}`))
    }
    setFailed(outcome.reason === 'failed')
  }, [draft, send])

  if (!enabled) return null

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={chat.unreadCount > 0 ? unreadId : undefined}
        onClick={() => setOpen(!open)}
        className="press bg-mint text-mint-ink hover-fine:bg-mint-hover focus-visible:outline-text fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 flex h-12 items-center gap-2 px-4.5 shadow-[0_12px_32px_-12px_rgba(0,255,162,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <MessageSquare aria-hidden="true" className="size-4.5" strokeWidth={2.6} />
        <span className="font-display text-[19px] leading-none font-black uppercase">
          {t('launcher')}
        </span>
        {chat.unreadCount > 0 && (
          <span
            aria-hidden="true"
            data-testid="chat-unread"
            className="bg-text text-bg font-display ml-0.5 min-w-5 px-1.5 text-center text-[13px] leading-5 font-black"
          >
            {chat.unreadCount > UNREAD_CAP ? `${UNREAD_CAP}+` : chat.unreadCount}
          </span>
        )}
      </button>
      {chat.unreadCount > 0 && (
        <span id={unreadId} className="sr-only">
          {t('unread', { count: chat.unreadCount })}
        </span>
      )}

      <ChatWindow
        open={open}
        onOpenChange={setOpen}
        launcherRef={launcherRef}
        meta={
          memberCount > 0 ? (
            <span className="type-label text-[10px]">
              {t('memberCount', { count: memberCount })}
            </span>
          ) : null
        }
      >
        {(textareaRef) => (
          <>
            <ChatMessages
              status={chat.status}
              messages={chat.messages}
              viewerId={viewerId}
              onRetry={chat.retry}
              hasMore={chat.hasMore}
              isFetchingOlder={chat.isFetchingOlder}
              olderFailed={chat.olderFailed}
              onReachTop={() => void chat.fetchOlder()}
            />
            <ChatTyping typers={typers} />
            <ChatComposer
              draft={draft}
              onDraftChange={handleDraftChange}
              onSend={() => void handleSend()}
              ready={chat.status === 'ready'}
              isSending={chat.isSending}
              cooldown={chat.cooldown}
              readOnly={readOnly}
              failed={failed}
              textareaRef={textareaRef}
            />
          </>
        )}
      </ChatWindow>
    </>
  )
}

'use client'

import { useId, type KeyboardEvent, type RefObject } from 'react'
import { SendHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CHAT, chatMessageBodySchema } from '@squadzr/schemas'
import { cn } from '@/lib/utils'
import type { ChatCooldown } from '../use-chat-cooldown'

/** The counter shows from this many characters on. */
const COUNTER_FROM = CHAT.MESSAGE_MAX_LENGTH - 100

interface ChatComposerProps {
  readonly draft: string
  readonly onDraftChange: (draft: string) => void
  readonly onSend: () => void
  /** The history is cached, so a pending message has somewhere to show. */
  readonly ready: boolean
  readonly isSending: boolean
  /** The anti-spam cooldown: nothing can be sent until it ends, and it ends by itself. */
  readonly cooldown: ChatCooldown | null
  /** The Squad is complete: the composer gives way to a banner. */
  readonly readOnly: boolean
  readonly failed: boolean
  readonly textareaRef?: RefObject<HTMLTextAreaElement | null>
}

/**
 * The message field: Enter sends, Shift+Enter adds a line. Send is enabled only for a body the shared
 * rules accept, while no other send is pending. The counter appears near the limit.
 */
export function ChatComposer({
  draft,
  onDraftChange,
  onSend,
  ready,
  isSending,
  cooldown,
  readOnly,
  failed,
  textareaRef,
}: ChatComposerProps) {
  const t = useTranslations('chat')
  const errorId = useId()
  const canSend = ready && !isSending && !cooldown && chatMessageBodySchema.safeParse(draft).success
  const length = draft.length
  const over = length > CHAT.MESSAGE_MAX_LENGTH

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (canSend) onSend()
  }

  if (readOnly) {
    return (
      <p role="status" className="border-line text-muted border-t p-3 text-[13px] font-semibold">
        {t('readOnly')}
      </p>
    )
  }

  return (
    <form
      className="border-line flex flex-col gap-1.5 border-t p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSend) onSend()
      }}
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={draft}
          rows={1}
          aria-label={t('composerLabel')}
          aria-describedby={failed ? errorId : undefined}
          aria-invalid={over || undefined}
          placeholder={t('placeholder')}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            'bg-bg text-text placeholder:text-faint scrollbar-thin min-h-11 min-w-0 flex-1 resize-none px-3 py-2.5 text-[16px] leading-snug font-medium outline-none field-sizing-content max-h-32 sm:text-[14px]',
            'focus-visible:shadow-[inset_0_0_0_1px_var(--color-mint)] disabled:opacity-50'
          )}
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={t('send')}
          className="press bg-mint text-mint-ink hover-fine:bg-mint-hover disabled:bg-track disabled:text-faint focus-visible:outline-text flex size-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <SendHorizontal aria-hidden="true" className="size-4.5" strokeWidth={2.4} />
        </button>
      </div>
      {cooldown && (
        <p className="text-amber text-[12px] font-semibold">
          {t('cooldown', { seconds: cooldown.remainingSeconds })}
        </p>
      )}
      {(failed || length >= COUNTER_FROM) && (
        <div className="flex items-start justify-between gap-3">
          <p id={errorId} role="alert" className="text-danger text-[12px] font-semibold">
            {failed ? t('sendFailed') : null}
          </p>
          {length >= COUNTER_FROM && (
            <span
              className={cn('type-code shrink-0 text-[10px]', over ? 'text-amber' : 'text-faint')}
            >
              {t('counter', { count: length, max: CHAT.MESSAGE_MAX_LENGTH })}
            </span>
          )}
        </div>
      )}
    </form>
  )
}

'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { Lock, SendHorizontal } from 'lucide-react'
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
  const bannerRef = useRef<HTMLParagraphElement>(null)
  // The field is still in the page when its ref is detached, so this tells whether the member was typing
  // when the Squad turned Ready: focus then moves to the banner instead of falling to the page body.
  const typingWhenRemoved = useRef(false)
  const fieldRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      if (textareaRef) textareaRef.current = node
      if (!node) return
      return () => {
        typingWhenRemoved.current = node === document.activeElement
        if (textareaRef) textareaRef.current = null
      }
    },
    [textareaRef]
  )

  useEffect(() => {
    if (!readOnly || !typingWhenRemoved.current) return
    typingWhenRemoved.current = false
    bannerRef.current?.focus()
  }, [readOnly])
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
      <p
        ref={bannerRef}
        role="status"
        tabIndex={-1}
        className="outline-none border-line bg-card text-text-2 flex min-h-17.25 items-center justify-center gap-2.5 border-t px-4 py-3 text-[13px] leading-snug font-bold tracking-[0.08em] uppercase"
      >
        <Lock aria-hidden="true" className="text-mint size-4 shrink-0" strokeWidth={2.4} />
        {t('readOnly')}
      </p>
    )
  }

  return (
    <form
      className="border-line relative flex flex-col gap-1.5 border-t p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSend) onSend()
      }}
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={fieldRef}
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
      {cooldown && <CooldownBar key={cooldown.endsAt} cooldown={cooldown} />}
      {cooldown && (
        <p className="text-amber text-[12px] font-semibold tabular-nums">
          {t('cooldown', { seconds: cooldown.remainingSeconds })}
        </p>
      )}
      {/* Said once when a cooldown starts. The seconds shown above are readable but not a live region. */}
      <p role="status" className="sr-only">
        {cooldown
          ? t('cooldownAnnouncement', { seconds: Math.ceil(cooldown.durationMs / 1000) })
          : null}
      </p>
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

/**
 * The bar along the composer's top edge that drains from full to empty over the cooldown. CSS runs it
 * from the cooldown's length, offset by the time already gone when it mounts, so the redraws of the
 * seconds left never touch it. A new cooldown is a new bar: the parent keys it by `endsAt`. Under reduced
 * motion the bar is hidden and the seconds left say it all.
 */
function CooldownBar({ cooldown }: { readonly cooldown: ChatCooldown }) {
  const [elapsedMs] = useState(() => cooldown.durationMs - cooldown.remainingMs)
  const style = {
    '--cooldown-duration': `${cooldown.durationMs}ms`,
    '--cooldown-delay': `${-elapsedMs}ms`,
  } as CSSProperties
  return (
    <div
      aria-hidden="true"
      className="bg-amber/15 absolute motion-reduce:hidden inset-x-0 -top-px h-0.5"
    >
      <div
        data-testid="chat-cooldown-bar"
        style={style}
        className="bg-amber animate-cooldown-drain h-full origin-left"
      />
    </div>
  )
}

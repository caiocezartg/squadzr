'use client'

import { useTranslations } from 'next-intl'
import { TypingDots } from '@/components/ds/typing-dots'
import type { TypingMember } from '../use-squad-typing'

interface ChatTypingProps {
  /** Who is typing, the viewer excluded, in the order they started. */
  readonly typers: readonly TypingMember[]
}

/**
 * The window's footer line above the composer: "Ana is typing…", or how many people are typing. Its
 * height is always kept, so the line coming and going never moves the messages or the composer, and it
 * is announced politely.
 */
export function ChatTyping({ typers }: ChatTypingProps) {
  const t = useTranslations('chat')
  const [first] = typers

  return (
    <div
      aria-live="polite"
      className="text-muted flex h-6 shrink-0 items-center gap-2 px-4 text-[12px] font-semibold"
    >
      {first && (
        <>
          <TypingDots />
          <span className="min-w-0 truncate">
            {t('typing', { count: typers.length, name: first.name })}
          </span>
        </>
      )}
    </div>
  )
}

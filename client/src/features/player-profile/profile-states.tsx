'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { cn } from '@/lib/utils'
import { ProfileHero } from './profile-hero'

/**
 * The ruled box the states without a profile share: diagonal stripes, a one-character glyph, a title and a
 * line. The glyph says which state it is: `0` for no history, `?` for a missing person, `!` for a failure.
 */
function StateBox({
  glyph,
  title,
  text,
  action,
  compact,
}: {
  readonly glyph: '0' | '?' | '!'
  readonly title: string
  readonly text: string
  readonly action?: ReactNode
  readonly compact: boolean
}) {
  return (
    <div
      className={cn(
        'mb-5 bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgba(255,255,255,0.012)_10px_20px)] px-4.5 py-5.5 text-center shadow-[inset_0_0_0_1px_var(--color-line)]',
        compact ? 'mx-4.5' : 'mx-6.5'
      )}
    >
      <div
        aria-hidden
        className="text-faint font-display mx-auto mb-3 grid size-10 place-items-center text-lg font-extrabold shadow-[inset_0_0_1px_1px_var(--color-track)]"
      >
        {glyph}
      </div>
      <h3 className="font-display text-[22px] leading-none font-black uppercase">{title}</h3>
      <p className="text-text-3 mx-auto mt-1.5 mb-4 max-w-57.5 text-[13px] leading-[1.55] font-medium">
        {text}
      </p>
      {action}
    </div>
  )
}

/** A person with no completed Squad: their identity stays, the numbers give way to this box. */
export function EmptyHistory({
  isOwn,
  name,
  compact,
}: {
  readonly isOwn: boolean
  readonly name: string
  readonly compact: boolean
}) {
  const t = useTranslations('playerProfile.empty')

  return (
    <div className="pt-4.5">
      <StateBox
        compact={compact}
        glyph="0"
        title={t('title')}
        text={isOwn ? t('own') : t('other', { name })}
        action={
          isOwn ? (
            <Button href="/squads" variant="primary">
              {t('find')}
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}

/** The profile does not exist: an empty header over the explanation and a way out. */
export function ProfileNotFound({
  onClose,
  compact,
}: {
  readonly onClose: () => void
  readonly compact: boolean
}) {
  const t = useTranslations('playerProfile.notFound')

  return (
    <>
      <ProfileHero compact={compact} />
      <div className="pt-1">
        <StateBox
          compact={compact}
          glyph="?"
          title={t('title')}
          text={t('text')}
          action={
            <Button variant="secondary" onClick={onClose}>
              {t('close')}
            </Button>
          }
        />
      </div>
    </>
  )
}

/** The read failed for any reason but a missing profile. */
export function ProfileLoadError({
  onRetry,
  compact,
}: {
  readonly onRetry: () => void
  readonly compact: boolean
}) {
  const t = useTranslations('playerProfile.error')

  return (
    <>
      <ProfileHero compact={compact} />
      <div className="pt-1" role="alert">
        <StateBox
          compact={compact}
          glyph="!"
          title={t('title')}
          text={t('text')}
          action={
            <Button variant="secondary" onClick={onRetry}>
              {t('retry')}
            </Button>
          }
        />
      </div>
    </>
  )
}

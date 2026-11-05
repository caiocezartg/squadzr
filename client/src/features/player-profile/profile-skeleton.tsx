'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { ProfileHero } from './profile-hero'

const BONE = 'bg-raised-2 animate-pulse'

/**
 * What a cold cache shows while the profile is read, with the geometry of the real one: the header,
 * the circle, two lines, three cells and five rows. A profile in the cache never shows it.
 */
export function ProfileSkeleton({ compact }: { readonly compact: boolean }) {
  const t = useTranslations('playerProfile')

  return (
    <div role="status" aria-label={t('loading')} aria-busy="true">
      <ProfileHero compact={compact} />
      <div
        className={cn(
          'relative flex',
          compact
            ? '-mt-12.5 flex-col items-start gap-3 px-4.5'
            : '-mt-14.5 min-h-26.5 items-end gap-4 px-6.5'
        )}
      >
        <div
          className={cn(
            BONE,
            'shrink-0 rounded-full shadow-[0_0_0_4px_var(--color-panel)]',
            compact ? 'size-18' : 'size-22'
          )}
        />
        <div className="w-full min-w-0 flex-1 space-y-2">
          <div className={cn(BONE, 'h-3 w-14')} />
          <div className={cn(BONE, compact ? 'h-8' : 'h-10', 'w-3/4 max-w-60')} />
          <div className={cn(BONE, 'h-3.5 w-1/3 max-w-32')} />
        </div>
      </div>
      <div
        className={cn(
          'grid shadow-[inset_0_0_0_1px_var(--color-line)]',
          compact ? 'mx-4.5 mt-4 grid-cols-2' : 'mx-6.5 mt-5.5 grid-cols-[1fr_1fr_1.5fr]'
        )}
      >
        {[0, 1, 2].map((cell) => (
          <div
            key={cell}
            className={cn(
              compact ? 'h-22' : 'h-26',
              cell === 2 && compact && 'col-span-2 shadow-[inset_0_1px_0_var(--color-line)]'
            )}
          >
            <div className={cn(BONE, 'm-3.5 h-[calc(100%-1.75rem)]')} />
          </div>
        ))}
      </div>
      <div className={compact ? 'px-4.5 pt-4.5 pb-5' : 'px-6.5 pt-5.5 pb-6.5'}>
        <div className={cn(BONE, 'h-4 w-24')} />
        <div className="mt-1.5">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="py-2.25">
              <div className={cn(BONE, compact ? 'h-10' : 'h-12.75')} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

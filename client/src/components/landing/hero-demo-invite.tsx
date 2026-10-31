'use client'

import { ArrowUpRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DiscordIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { DEMO_SQUAD } from './hero-demo-data'

/**
 * The Discord invite bar the squad unlocks at 5/5. It rises 18px into place and fades in (reference,
 * Motion: Hero). It only illustrates the product, so it is not a link and takes no focus.
 */
export function HeroDemoInvite({ unlocked }: { readonly unlocked: boolean }) {
  const t = useTranslations('landing.demo')

  return (
    <div
      data-unlocked={unlocked ? '' : undefined}
      className={cn(
        'bg-ds-discord flex translate-y-4.5 flex-wrap items-center gap-3.5 py-3.5 pr-3.5 pl-4.5 text-white opacity-0',
        'transition-[opacity,translate] duration-500 ease-out data-unlocked:translate-y-0 data-unlocked:opacity-100'
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center bg-white/16">
        <DiscordIcon className="size-6" />
      </span>
      <span className="flex min-w-48 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-extrabold">{t('inviteTitle')}</span>
        <span className="font-ds-mono text-[12.5px] opacity-90">{DEMO_SQUAD.invite}</span>
      </span>
      {/* The ink of the DS Button's `light` variant, which the artboard gives this action. */}
      <span className="inline-flex items-center gap-2 bg-white px-4 py-3 text-[13px] font-extrabold text-[#2b33a8]">
        {t('inviteOpen')}
        <ArrowUpRight aria-hidden className="size-3.25" strokeWidth={2.8} />
      </span>
    </div>
  )
}

'use client'

import type { CSSProperties } from 'react'
import { Clock, Search, Send, User, Users, UserX, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { SOLO_CHIPS, type HeroSpots, type SoloChip, type SoloChipKey } from './hero-solo-data'
import { chipTiming } from './hero-timeline'

const CHIP_ICONS: Record<SoloChipKey, LucideIcon> = {
  queue: Clock,
  friends: Users,
  lobby: User,
  invite: Send,
  searching: Search,
  duo: UserX,
}

/** The chip's spot in each tier and its lean, as the custom properties its classes read. */
function placement(spots: HeroSpots, tilt: number): CSSProperties {
  const properties: Record<`--${string}`, string> = { '--tilt': `${tilt}deg` }
  for (const [tier, spot] of Object.entries(spots)) {
    properties[`--x-${tier}`] = `${spot[0]}em`
    properties[`--y-${tier}`] = `${spot[1]}em`
  }
  return properties as CSSProperties
}

/** Keeps a chip out of the tiers it has no spot in. */
function tierVisibility(spots: HeroSpots): string {
  return cn(
    !spots.phone && 'max-md:hidden',
    !spots.tablet && 'md:max-xl:hidden',
    !spots.wide && 'xl:hidden'
  )
}

interface SoloLifeChipProps {
  readonly chip: SoloChip
  /** Its place in the list, which orders the chips' way out. */
  readonly index: number
}

/**
 * One sign of playing solo, in the mono of the app's labels: an icon in a vacant seat's circle, what it
 * is, and its bad news in red. It rests out of sight, which is how reduced motion keeps it; the story
 * brings it in and takes it away.
 */
function SoloLifeChip({ chip, index }: SoloLifeChipProps) {
  const t = useTranslations('landing.hero.solo')
  const Icon = CHIP_ICONS[chip.key]

  return (
    <span
      className={cn(
        'absolute top-(--y-phone) left-(--x-phone) -translate-x-1/2 -translate-y-1/2 rotate-(--tilt) opacity-0 md:top-(--y-tablet) md:left-(--x-tablet) xl:top-(--y-wide) xl:left-(--x-wide)',
        'motion-safe:animate-hero-chip',
        tierVisibility(chip.spots)
      )}
      style={{ ...placement(chip.spots, chip.tilt), ...chipTiming(chip.rank, index) }}
    >
      <span className="motion-safe:animate-hero-bob text-text-2 flex items-center gap-2 bg-[rgba(20,21,26,0.86)] py-1.25 pr-2.75 pl-1.25 font-mono text-[11px] font-bold tracking-[0.04em] whitespace-nowrap shadow-[0_0_0_1px_#2c2d34,0_14px_34px_-14px_rgba(0,0,0,0.9)] backdrop-blur-[6px] md:gap-2.5 md:py-1.5 md:pr-3.5 md:pl-1.5 md:text-[13px]">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2a2b31] text-[#8a8d96] shadow-[inset_0_0_0_1px_#3a3b42] md:size-7.5">
          <Icon aria-hidden className="size-3.25 md:size-3.75" />
        </span>
        <span>{t(`${chip.key}.label`)}</span>
        <span className="text-danger">· {t(`${chip.key}.value`)}</span>
      </span>
    </span>
  )
}

/**
 * What playing solo looks like, floating around the headline until the strike: the queue timer, the
 * friends who are offline, the invite that expired. Its origin is the headline's top centre and it
 * takes the headline's size, so each chip's spot, in ems, holds at any width. All decoration.
 */
export function SoloLifeChips() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2">
      {SOLO_CHIPS.map((chip, index) => (
        <SoloLifeChip key={chip.key} chip={chip} index={index} />
      ))}
    </div>
  )
}

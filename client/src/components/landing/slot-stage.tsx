'use client'

import * as m from 'motion/react-m'
import { UserRound } from 'lucide-react'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { AppLink } from '@/components/layout/app-link'
import { cn } from '@/lib/utils'
import {
  DEMO_FOUNDERS,
  DEMO_MEMBERS,
  demoArtUrl,
  type DemoGame,
  type DemoMember,
} from './hero-demo-data'

/** A member's avatar at the stage's size: 72px, halved below 640px. The host wears the crown. */
function StageAvatar({ children }: { readonly children: ReactNode }) {
  return <span className="block size-18 origin-top-left scale-50 sm:scale-100">{children}</span>
}

/** The viewer has no avatar yet: the slot draws a mint one with a person in it. */
function YouAvatar() {
  return (
    <span className="bg-mint text-mint-ink flex size-18 items-center justify-center rounded-full shadow-[0_0_28px_rgba(0,255,162,0.45)]">
      <UserRound aria-hidden className="size-9" strokeWidth={2.25} />
    </span>
  )
}

interface SlotArtProps {
  readonly games: readonly DemoGame[]
  readonly active: DemoGame
  readonly index: number
}

/**
 * The slot's strip of the game's key art. Each slot shows its own fifth of one picture, laid across the
 * whole stage, so the art is only whole once the squad is: a waiting slot keeps its strip dark and grey,
 * and locking in lights it. Every game the viewer has picked keeps its picture, and the switch fades
 * between them. The art is decoration.
 */
function SlotArt({ games, active, index }: SlotArtProps) {
  const style: CSSProperties = {
    width: 'calc(500% + 4 * var(--stage-gap))',
    left: `calc(${-index} * (100% + var(--stage-gap)))`,
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute inset-0 opacity-25 brightness-50 grayscale transition-[opacity,filter] duration-500 ease-out',
        'group-data-locked:opacity-100 group-data-locked:brightness-90 group-data-locked:grayscale-0'
      )}
    >
      {games.map((game) => (
        <img
          key={game.id}
          src={demoArtUrl(game)}
          alt=""
          decoding="async"
          fetchPriority={game.id === active.id ? 'high' : 'low'}
          className={cn(
            'absolute top-0 h-full max-w-none object-cover transition-opacity duration-500 ease-out',
            game.id === active.id ? 'opacity-100' : 'opacity-0'
          )}
          style={{ ...style, objectPosition: `50% ${game.focusY}` }}
        />
      ))}
    </span>
  )
}

interface StageSlotProps {
  readonly member: DemoMember
  /** The slot's place in the stage, from 0. */
  readonly index: number
  readonly locked: boolean
  /** Members that lock in from now on enter with their spring, sweep and stamp. */
  readonly scripted: boolean
  readonly games: readonly DemoGame[]
  readonly game: DemoGame
}

/**
 * One slot of the stage, drawn like an agent card: the art strip, a grade that keeps the plate legible,
 * the slot's number, the avatar on its pedestal of light, and the name plate with the status.
 *
 * Waiting, the slot scans: a band of light falls through it, a dashed ring turns around the vacant
 * avatar, and its status reads "searching". Locking in lights its art and its edge, sends one sweep of
 * light across it, settles the avatar on a spring and lands the status like a stamp. The viewer's slot,
 * the last one, is the hero's way in: it links to the board, where the viewer takes the last slot of a
 * squad, and lights up under the pointer or the keyboard.
 */
function StageSlot({ member, index, locked, scripted, games, game }: StageSlotProps) {
  const t = useTranslations('landing.demo')
  const isYou = member.tag === null
  const tag = member.tag ?? t('you')
  const enters = index >= DEMO_FOUNDERS
  const fresh = locked && scripted && enters

  const card = (
    <>
      <SlotArt games={games} active={game} index={index} />
      <span
        aria-hidden="true"
        className="from-bg via-bg/55 to-bg/10 absolute inset-0 bg-linear-to-t"
      />

      {/* Searching: a band of light falls through the slot until it locks in. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden transition-opacity duration-200 ease-out group-data-locked:opacity-0"
      >
        <span className="via-mint/10 motion-safe:animate-slot-scan absolute inset-x-0 top-0 block h-1/3 bg-linear-to-b from-transparent to-transparent" />
      </span>

      {/* The lock-in sweep: once, across the slot, as it locks in under the script. */}
      {fresh && (
        <span
          aria-hidden="true"
          className="motion-safe:animate-slot-sweep pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-linear-to-r from-transparent via-white/30 to-transparent opacity-0"
        />
      )}

      {/* The lit edge, and the bar along the top that grows as the slot locks in. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-0 opacity-0 transition-opacity duration-300 ease-out',
          'shadow-[inset_0_0_0_1.5px_var(--color-mint),inset_0_-60px_80px_-50px_rgba(0,255,162,0.45)]',
          'group-data-locked:opacity-100'
        )}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 shadow-[inset_0_0_0_1px_var(--color-line)] transition-opacity duration-300 ease-out group-data-locked:opacity-0"
      />
      <span
        aria-hidden="true"
        className="bg-mint absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 transition-transform duration-300 ease-out group-data-locked:scale-x-100 sm:h-1"
      />

      {/* The glare follows the pointer over a fine-pointer screen (`useHeroPointer`). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-200 ease-out group-hover-fine:opacity-100"
      >
        <span
          data-glare=""
          className="absolute -inset-1/2 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_45%)] transition-transform duration-300 ease-out"
        />
      </span>

      <span
        aria-hidden="true"
        className="font-display text-text/15 group-data-locked:text-text/30 absolute top-1 left-2 hidden text-5xl leading-none font-black transition-colors duration-300 sm:block lg:top-2 lg:left-3 lg:text-6xl"
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <span className="relative flex h-full flex-col items-center justify-end gap-2 px-1 pb-2.5 sm:gap-3 sm:px-3 sm:pb-4">
        {/* The pedestal: a pool of light under the avatar, lit once the slot is. */}
        <span className="relative size-9 sm:size-18">
          <span
            aria-hidden="true"
            className="absolute -inset-x-6 -bottom-5 h-10 bg-[radial-gradient(ellipse_at_center,rgba(0,255,162,0.5),transparent_70%)] opacity-0 blur-md transition-opacity duration-500 ease-out group-data-locked:opacity-100 sm:-inset-x-10 sm:-bottom-8 sm:h-16"
          />
          {!locked && (
            <>
              <span className="absolute inset-0">
                <StageAvatar>
                  <Avatar size={72} state="vacant" />
                </StageAvatar>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'motion-safe:animate-slot-ring absolute -inset-1 rounded-full border border-dashed sm:-inset-2 sm:border-2',
                  isYou ? 'border-mint/70' : 'border-text-3/40'
                )}
              />
            </>
          )}
          {locked &&
            (enters ? (
              <m.span
                className="absolute inset-0"
                initial={scripted ? { opacity: 0, transform: 'scale(0.9)' } : false}
                animate={{ opacity: 1, transform: 'scale(1)' }}
                transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
              >
                <StageAvatar>
                  {isYou ? (
                    <YouAvatar />
                  ) : (
                    <Avatar size={72} playerId={member.id} name={member.name} />
                  )}
                </StageAvatar>
              </m.span>
            ) : (
              <span className="absolute inset-0">
                <StageAvatar>
                  <Avatar size={72} playerId={member.id} name={member.name} host={index === 0} />
                </StageAvatar>
              </span>
            ))}
        </span>

        <span
          className={cn(
            'w-full truncate text-center leading-none transition-opacity duration-150 ease-out',
            'font-ds-mono text-[10px] font-bold sm:font-display sm:text-xl sm:font-extrabold lg:text-2xl',
            isYou ? 'text-mint uppercase' : 'text-text opacity-0 group-data-locked:opacity-100'
          )}
        >
          {tag}
        </span>

        <span className="font-ds-mono relative hidden h-5 w-full text-center text-[11px] leading-5 font-bold tracking-[0.14em] sm:block">
          {isYou && (
            <span className="text-mint-ink absolute inset-0 opacity-0 transition-opacity duration-150 ease-out group-hover-fine:opacity-100 group-has-focus-visible:opacity-100">
              <span className="bg-mint px-1.5 py-0.5">{t('youSlotHint')}</span>
            </span>
          )}
          {locked ? (
            <span
              className={cn(
                'absolute inset-0 group-data-fresh:motion-safe:animate-slot-stamp',
                isYou
                  ? 'text-mint transition-opacity duration-150 ease-out group-hover-fine:opacity-0 group-has-focus-visible:opacity-0'
                  : 'text-text-2'
              )}
            >
              <span className="bg-mint/12 px-1.5 py-0.5">{t('slotReady')}</span>
            </span>
          ) : (
            <span
              className={cn(
                'absolute inset-0',
                isYou
                  ? 'text-mint motion-safe:animate-slot-breathe group-hover-fine:invisible group-has-focus-visible:invisible'
                  : 'text-ds-muted'
              )}
            >
              {isYou ? t('slotYours') : t('slotSearching')}
            </span>
          )}
        </span>
      </span>
    </>
  )

  const surface = cn(
    'relative block size-full overflow-hidden bg-panel transition-transform duration-300 ease-out will-change-transform',
    isYou && 'focus-visible:outline-mint focus-visible:outline-2 focus-visible:outline-offset-4'
  )

  return (
    <li
      data-locked={locked ? '' : undefined}
      data-fresh={fresh ? '' : undefined}
      data-you={isYou ? '' : undefined}
      className="group relative aspect-9/16 min-w-0 perspective-[900px] sm:aspect-2/3 lg:aspect-3/4"
    >
      {isYou ? (
        <AppLink href="/squads" data-tilt="" aria-label={t('youSlotAction')} className={surface}>
          {card}
          <span
            aria-hidden="true"
            className="bg-mint/10 absolute inset-0 opacity-0 transition-opacity duration-200 ease-out group-hover-fine:opacity-100 group-has-focus-visible:opacity-100"
          />
        </AppLink>
      ) : (
        <span data-tilt="" className={surface}>
          {card}
        </span>
      )}
    </li>
  )
}

interface SlotStageProps {
  /** Slots locked in: the first `filled` members. */
  readonly filled: number
  readonly scripted: boolean
  /** The game on the stage, and every game the viewer has picked, whose art stays loaded. */
  readonly game: DemoGame
  readonly games: readonly DemoGame[]
  readonly stageRef: Ref<HTMLOListElement>
}

/**
 * The slot stage: five agent cards in a row at every width, like a champion select where players lock
 * in one by one. The last slot is the viewer, who closes the squad.
 */
export function SlotStage({ filled, scripted, game, games, stageRef }: SlotStageProps) {
  const t = useTranslations('landing.demo')

  return (
    <ol
      ref={stageRef}
      aria-label={t('stageLabel', { name: game.squad.name })}
      className="grid grid-cols-5 gap-(--stage-gap) [--stage-gap:--spacing(1.5)] sm:[--stage-gap:--spacing(3)] lg:[--stage-gap:--spacing(4)]"
    >
      {DEMO_MEMBERS.map((member, index) => (
        <StageSlot
          key={member.id}
          member={member}
          index={index}
          locked={index < filled}
          scripted={scripted}
          games={games}
          game={game}
        />
      ))}
    </ol>
  )
}

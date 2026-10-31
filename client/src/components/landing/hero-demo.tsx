'use client'

import { useId, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { SquadCard } from '@/features/squad-list'
import { cn } from '@/lib/utils'
import { DEMO_TOTAL, demoSquad, type DemoGame } from './hero-demo-data'
import { HeroDemoInvite } from './hero-demo-invite'
import { HeroGameTabs } from './hero-game-tabs'
import { SlotStage } from './slot-stage'
import { useHeroDemo } from './use-hero-demo'

interface SquadCounterProps {
  readonly game: DemoGame
  readonly filled: number
  /** The count changes under the script: each new number rolls in. */
  readonly scripted: boolean
}

/** The squad's code and its count, like the head of a pre-match screen. Mint once the squad is full. */
function SquadCounter({ game, filled, scripted }: SquadCounterProps) {
  const complete = filled === DEMO_TOTAL

  return (
    <p aria-hidden="true" className="flex items-baseline gap-3">
      <span className="type-code text-ds-muted hidden sm:inline">#{game.squad.code}</span>
      <span
        className={cn(
          'type-counter flex text-4xl transition-colors duration-300 sm:text-5xl',
          complete ? 'text-mint' : 'text-text'
        )}
      >
        <span
          key={filled}
          className={cn('inline-block', scripted && 'motion-safe:animate-count-in')}
        >
          {filled}
        </span>
        <span className="text-faint">/{DEMO_TOTAL}</span>
      </span>
    </p>
  )
}

interface ResultProps {
  readonly game: DemoGame
  readonly filled: number
  readonly scripted: boolean
}

/**
 * What the stage leads to, on a rail that fills with the squad: the board's own `SquadCard`, which
 * follows the count, and the Lobby's Discord panel, which unlocks at 5/5. Both are real components with
 * mock data and no network. To assistive technology they are one illustration, described in its final
 * state, and inert, so none of their actions can be reached.
 */
function HeroDemoResult({ game, filled, scripted }: ResultProps) {
  const t = useTranslations('landing.demo')
  const complete = filled === DEMO_TOTAL

  return (
    <div role="img" aria-label={t('label', { game: game.name })} className="flex flex-col gap-4">
      <div
        aria-hidden="true"
        className="bg-track relative h-0.5 overflow-hidden"
        data-complete={complete ? '' : undefined}
      >
        <span
          className="bg-mint absolute inset-0 origin-left transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${filled / DEMO_TOTAL})` }}
        />
      </div>
      <div inert className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="type-label text-ds-muted">{t('onBoard')}</p>
          <SquadCard squad={demoSquad(game, filled, t('you'))} preview />
        </div>
        <div className="flex flex-col gap-2">
          <p
            className={cn(
              'type-label transition-colors duration-300',
              complete ? 'text-mint' : 'text-ds-muted'
            )}
          >
            {t('inLobby')}
          </p>
          <HeroDemoInvite game={game} filled={filled} entering={scripted && complete} />
        </div>
      </div>
    </div>
  )
}

interface HeroDemoProps {
  readonly game: DemoGame
  /** Every game the viewer has picked, whose art stays loaded. */
  readonly games: readonly DemoGame[]
  readonly onPick: (game: DemoGame) => void
  readonly onIntent: (game: DemoGame) => void
}

/**
 * The hero's demo: a squad filling up while the viewer watches. The switcher picks the game, the slot
 * stage locks its players in one by one, and the board card and the Discord panel follow below it, so
 * the eye travels slots → card → invite. The server HTML and the first render show it full;
 * `useHeroDemo` plays the story once, and again whenever the viewer picks a game.
 */
export function HeroDemo({ game, games, onPick, onIntent }: HeroDemoProps) {
  const panelId = useId()
  const stageRef = useRef<HTMLOListElement>(null)
  const demo = useHeroDemo(stageRef)

  return (
    <div
      data-instant={demo.instant ? '' : undefined}
      className="flex flex-col gap-4 data-instant:[&_*]:transition-none sm:gap-5"
    >
      <div className="flex items-end justify-between gap-4">
        <HeroGameTabs
          active={game.id}
          controls={panelId}
          onSelect={(picked) => {
            onPick(picked)
            demo.replay()
          }}
          onIntent={onIntent}
        />
        <SquadCounter game={game} filled={demo.filled} scripted={demo.scripted} />
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`hero-game-${game.id}`}
        className="flex flex-col gap-6 sm:gap-8"
      >
        <SlotStage
          filled={demo.filled}
          scripted={demo.scripted}
          game={game}
          games={games}
          stageRef={stageRef}
        />
        <HeroDemoResult game={game} filled={demo.filled} scripted={demo.scripted} />
      </div>
    </div>
  )
}

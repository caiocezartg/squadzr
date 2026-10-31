'use client'

import { useRef, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { DEMO_GAMES, type DemoGame, type DemoGameId } from './hero-demo-data'

interface HeroGameTabsProps {
  readonly active: DemoGameId
  /** The panel the tabs drive: the stage and its result. */
  readonly controls: string
  readonly onSelect: (game: DemoGame) => void
  /** The viewer is about to pick this game, so its art can start loading. */
  readonly onIntent: (game: DemoGame) => void
}

/** The keys that move between tabs, and where each one goes from `index`. */
function targetIndex(key: string, index: number, count: number): number | null {
  if (key === 'ArrowRight') return (index + 1) % count
  if (key === 'ArrowLeft') return (index - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

/**
 * The hero's game switcher, a tab list like a game's mode select. Picking a game swaps the stage's art,
 * squad and tags, and plays the lock-in story again; picking the game already on the stage replays it
 * too. The arrows, Home and End move between the tabs and pick the game they land on, and only the
 * active tab is in the tab order.
 */
export function HeroGameTabs({ active, controls, onSelect, onIntent }: HeroGameTabsProps) {
  const t = useTranslations('landing.demo')
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = targetIndex(event.key, index, DEMO_GAMES.length)
    const game = next === null ? undefined : DEMO_GAMES[next]
    if (next === null || !game) return
    event.preventDefault()
    tabs.current[next]?.focus()
    onSelect(game)
  }

  return (
    <div role="tablist" aria-label={t('gamesLabel')} className="flex">
      {DEMO_GAMES.map((game, index) => {
        const selected = game.id === active
        return (
          <button
            key={game.id}
            ref={(element) => {
              tabs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`hero-game-${game.id}`}
            aria-selected={selected}
            aria-controls={controls}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onSelect(game)
            }}
            onKeyDown={(event) => {
              handleKeyDown(event, index)
            }}
            onPointerEnter={() => {
              onIntent(game)
            }}
            onFocus={() => {
              onIntent(game)
            }}
            className={cn(
              'press font-ds-mono relative min-h-11 px-3 text-xs font-bold tracking-[0.12em] uppercase sm:px-4 sm:text-[13px]',
              'text-ds-muted hover-fine:text-text hover-fine:bg-white/5 aria-selected:text-text',
              'focus-visible:outline-mint focus-visible:outline-2 focus-visible:-outline-offset-2',
              'after:bg-mint after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:transition-transform after:duration-200 after:ease-out',
              'aria-selected:after:scale-x-100 aria-selected:after:shadow-[0_0_12px_var(--color-mint)] sm:after:inset-x-4'
            )}
          >
            {game.short}
          </button>
        )
      })}
    </div>
  )
}

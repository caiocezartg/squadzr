'use client'

import { useState } from 'react'
import { DEFAULT_DEMO_GAME, type DemoGame } from './hero-demo-data'

export interface DemoGames {
  /** The game on the stage. */
  readonly game: DemoGame
  /** Every game the viewer has picked or reached for, in that order; their art stays mounted. */
  readonly games: readonly DemoGame[]
  /** The viewer is about to pick `game` (hover or focus): its art starts loading. */
  readonly reach: (game: DemoGame) => void
  /** The viewer picked `game`: it takes the stage. */
  readonly pick: (game: DemoGame) => void
}

/**
 * The hero demo's game, and the games whose art it keeps. A game stays loaded once reached, so a
 * switch back fades instead of loading again, and a game's art starts loading on hover or focus,
 * before it is picked.
 */
export function useDemoGames(): DemoGames {
  const [game, setGame] = useState<DemoGame>(DEFAULT_DEMO_GAME)
  const [games, setGames] = useState<readonly DemoGame[]>([DEFAULT_DEMO_GAME])

  const reach = (next: DemoGame) => {
    setGames((current) => (current.includes(next) ? current : [...current, next]))
  }

  return {
    game,
    games,
    reach,
    pick: (next) => {
      reach(next)
      setGame(next)
    },
  }
}

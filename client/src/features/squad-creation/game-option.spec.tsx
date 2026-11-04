/**
 * #105: the result row highlights the part of the name the typed term matches, folding accents,
 * case and punctuation like the server's search; a result found by alias or similarity is not
 * highlighted.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EnglishIntlProvider } from '@/test/intl'
import { gameCs2, gameLol } from '@/test/fixtures'
import type { Game } from '@/types'
import { GameOption } from './game-option'

const pokemonGo: Game = {
  ...gameLol,
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Pokémon Go',
}
const counterStrike: Game = { ...gameCs2, name: 'Counter-Strike' }

function renderOption(game: Game, term: string): HTMLElement {
  render(
    <EnglishIntlProvider>
      <ul>
        <GameOption
          id="option"
          game={game}
          term={term}
          selected={false}
          active={false}
          onSelect={() => {}}
          onHover={() => {}}
        />
      </ul>
    </EnglishIntlProvider>
  )
  return screen.getByRole('option')
}

function highlighted(option: HTMLElement): string | null {
  return option.querySelector('mark')?.textContent ?? null
}

describe('game option highlight', () => {
  it('highlights "Pokémon" for "pokemon"', () => {
    expect(highlighted(renderOption(pokemonGo, 'pokemon'))).toBe('Pokémon')
  })

  it('highlights "Counter-Strike" for "counter strike"', () => {
    expect(highlighted(renderOption(counterStrike, 'counter strike'))).toBe('Counter-Strike')
  })

  it('keeps the rest of the name around the highlight', () => {
    const option = renderOption(pokemonGo, 'go')

    expect(highlighted(option)).toBe('Go')
    expect(option.querySelector('span.truncate')).toHaveTextContent('Pokémon Go')
  })

  it('highlights nothing in "League of Legends" for "lol", which matched by its alias', () => {
    expect(highlighted(renderOption(gameLol, 'lol'))).toBeNull()
  })

  it('highlights nothing without a term', () => {
    expect(highlighted(renderOption(gameLol, ''))).toBeNull()
  })
})

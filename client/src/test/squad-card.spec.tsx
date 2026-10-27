/**
 * Tests for the SquadCard (CCC-40 r4–r6, CCC-79, CCC-109).
 *
 * The card is part of the server HTML of the Squad Board, so it must be visible before any script
 * runs and through hydration: it never starts at zero opacity, and nothing animates it on mount. Its
 * three states are a link to the Lobby for a member, a button that joins for an open Squad, and a
 * disabled card for a full Squad. Tests find the card by its role and accessible name.
 *
 * jsdom has no `Element.animate`, so each test installs a recorder and asserts that no animation starts.
 */

import { StrictMode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SquadCard } from '@/features/squad-list'
import type { Squad } from '@/types'
import { fullSquad, memberSquad, openSquad, previewMembers } from './fixtures'
import { EnglishIntlProvider } from './intl'

let animateCalls: Array<{ element: Element; keyframes: unknown }> = []

beforeEach(() => {
  animateCalls = []
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: function animate(this: Element, keyframes: unknown) {
      animateCalls.push({ element: this, keyframes })
      return { cancel: vi.fn() } as unknown as Animation
    },
  })
})

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'animate')
})

const OPEN_NAME = 'Ranked grind — League of Legends, EN-US, 1 of 5 players'

function memberAvatars(): HTMLElement[] {
  return screen.getAllByRole('img', { name: /^(Mia|Guest \d)$/ })
}

/**
 * The circles of the rail, in order, as what each one draws: a member (a named avatar), a neutral
 * filled circle, or a vacant one. The filled and vacant circles are decorative, so they have no role;
 * every circle is the one element that carries the rail's `ring-card` cut-out.
 */
function railKinds(card: HTMLElement): Array<'member' | 'filled' | 'vacant'> {
  return Array.from(card.querySelectorAll('.ring-card'), (circle) => {
    if (circle.querySelector('[role="img"]')) return 'member'
    return circle.querySelector('.bg-faint') ? 'filled' : 'vacant'
  })
}

describe('squad card — no entrance animation', () => {
  it('starts visible on mount, with no animation and no inline opacity', () => {
    render(<SquadCard squad={openSquad} />)

    const card = screen.getByRole('button', { name: OPEN_NAME })
    expect(card.style.opacity).toBe('')
    expect(card.className).not.toMatch(/(^|\s)opacity-0(\s|$)/)
    expect(animateCalls).toHaveLength(0)
  })

  it('stays visible through a StrictMode mount, which runs the effects twice', () => {
    render(
      <StrictMode>
        <SquadCard squad={openSquad} />
      </StrictMode>
    )

    expect(screen.getByRole('button', { name: OPEN_NAME }).style.opacity).toBe('')
    expect(animateCalls).toHaveLength(0)
  })

  it('is visible in the server HTML, so hydration has nothing to animate', () => {
    const markup = renderToStaticMarkup(
      <EnglishIntlProvider>
        <SquadCard squad={openSquad} />
      </EnglishIntlProvider>
    )
    const [card] = markup.match(/^<button[^>]*>/) ?? []

    expect(card).toBeDefined()
    expect(card).not.toMatch(/opacity-0/)
    expect(card).not.toMatch(/style="[^"]*opacity/)
  })

  it('reveals its hover state for fine pointers only', () => {
    render(<SquadCard squad={openSquad} />)

    const card = screen.getByRole('button', { name: OPEN_NAME })
    expect(card.className).toContain('hover-fine:bg-raised')
    expect(card.className).not.toMatch(/(^|\s)hover:/)
    expect(screen.getByText('Enter').className).toContain('group-hover-fine:opacity-100')
  })
})

describe('squad card — layout', () => {
  it('shows the language, the code, the name and the members over the maximum', () => {
    render(<SquadCard squad={{ ...openSquad, memberCount: 3 }} />)

    const card = screen.getByRole('button', {
      name: 'Ranked grind — League of Legends, EN-US, 3 of 5 players',
    })
    expect(within(card).getByText('EN-US')).toBeInTheDocument()
    expect(within(card).getByText('#ABC123')).toBeInTheDocument()
    expect(within(card).getByText('Ranked grind')).toHaveClass('line-clamp-2')
    expect(within(card).getByText('3')).toBeInTheDocument()
    expect(within(card).getByText('/5')).toBeInTheDocument()
  })

  it('counts one member for a squad without a count', () => {
    const { memberCount: _count, ...withoutCount } = openSquad
    render(<SquadCard squad={withoutCount as Squad} />)

    expect(screen.getByRole('button', { name: OPEN_NAME })).toBeInTheDocument()
  })

  it('shows the first two tags and the rest as +N', () => {
    render(<SquadCard squad={{ ...openSquad, tags: ['ranked', 'chill', 'mic', 'duo'] }} />)

    expect(screen.getByText('#ranked')).toBeInTheDocument()
    expect(screen.getByText('#chill')).toBeInTheDocument()
    expect(screen.queryByText('#mic')).not.toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('shows no +N for two tags or fewer', () => {
    render(<SquadCard squad={openSquad} />)

    expect(screen.getByText('#ranked')).toBeInTheDocument()
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument()
  })

  it('names the game on the poster the Squad carries', () => {
    const squad = {
      ...openSquad,
      game: {
        ...openSquad.game,
        name: 'Arc Raiders',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co123.webp',
      },
    }
    render(<SquadCard squad={squad} />)

    expect(screen.getByRole('img', { name: 'Arc Raiders' })).toHaveAttribute(
      'src',
      squad.game.coverUrl
    )
    expect(
      screen.getByRole('button', { name: 'Ranked grind — Arc Raiders, EN-US, 1 of 5 players' })
    ).toBeInTheDocument()
  })
})

describe('squad card — poster', () => {
  it('leaves the ground in place of a cover that fails to load', () => {
    render(<SquadCard squad={openSquad} />)

    fireEvent.error(screen.getByRole('img', { name: 'League of Legends' }))

    expect(screen.queryByRole('img', { name: 'League of Legends' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: OPEN_NAME })).toBeInTheDocument()
  })

  it('gives a different cover its own try after one failed', () => {
    const { rerender } = render(<SquadCard squad={openSquad} />)
    fireEvent.error(screen.getByRole('img', { name: 'League of Legends' }))

    const otherGame = { ...openSquad.game, coverUrl: 'https://cdn.squadzr.test/covers/other.jpg' }
    rerender(<SquadCard squad={{ ...openSquad, game: otherGame }} />)

    expect(screen.getByRole('img', { name: 'League of Legends' })).toHaveAttribute(
      'src',
      otherGame.coverUrl
    )
  })
})

describe('squad card — member', () => {
  it('is a link to the Lobby with the Joined badge and the Open room call to action', () => {
    const onJoin = vi.fn()
    render(<SquadCard squad={memberSquad} onJoin={onJoin} />)

    const card = screen.getByRole('link', {
      name: 'Casual five stack — League of Legends, PT-BR, 3 of 4 players',
    })
    expect(card).toHaveAttribute('href', '/squads/MEM111')
    expect(within(card).getByText('Joined')).toBeInTheDocument()
    expect(within(card).getByText('Open room')).toBeInTheDocument()
    expect(within(card).queryByText('Enter')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('stays a link to the Lobby when the Squad is full', () => {
    render(<SquadCard squad={{ ...fullSquad, isMember: true }} />)

    expect(
      screen.getByRole('link', { name: 'Full lobby — Counter-Strike 2, PT-BR, 4 of 4 players' })
    ).toHaveAttribute('href', '/squads/XYZ789')
  })
})

describe('squad card — non-member, open', () => {
  it('is a button that runs the join workflow with the Squad code', () => {
    const onJoin = vi.fn()
    render(<SquadCard squad={openSquad} onJoin={onJoin} />)

    const card = screen.getByRole('button', { name: OPEN_NAME })
    expect(within(card).getByText('Enter')).toBeInTheDocument()
    expect(within(card).queryByText('Joined')).not.toBeInTheDocument()

    fireEvent.click(card)

    expect(onJoin).toHaveBeenCalledTimes(1)
    expect(onJoin).toHaveBeenCalledWith('ABC123')
  })

  it('ignores clicks while its join request is in flight', () => {
    const onJoin = vi.fn()
    render(<SquadCard squad={openSquad} onJoin={onJoin} isLoading />)

    const card = screen.getByRole('button', { name: OPEN_NAME })
    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(card).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(card)

    expect(onJoin).not.toHaveBeenCalled()
  })
})

describe('squad card — full, non-member', () => {
  it('is not interactive, with the Full overlay and a grayscale poster', () => {
    const onJoin = vi.fn()
    render(<SquadCard squad={fullSquad} onJoin={onJoin} />)

    const card = screen.getByRole('button', {
      name: 'Full lobby — Counter-Strike 2, PT-BR, 4 of 4 players',
    })
    expect(card).toHaveAttribute('aria-disabled', 'true')
    expect(within(card).getByText('Full')).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: 'Counter-Strike 2' })).toHaveClass('grayscale')
    expect(within(card).queryByText('Enter')).not.toBeInTheDocument()

    fireEvent.click(card)

    expect(onJoin).not.toHaveBeenCalled()
  })
})

describe('squad card — who joined', () => {
  it('draws the members of the preview in order, then the vacant circles', () => {
    render(
      <SquadCard
        squad={{ ...openSquad, maxPlayers: 5, memberCount: 3, memberPreview: previewMembers(3) }}
      />
    )

    const names = memberAvatars()
    expect(names.map((avatar) => avatar.getAttribute('aria-label'))).toEqual([
      'Mia',
      'Guest 1',
      'Guest 2',
    ])
    expect(railKinds(screen.getByRole('button'))).toEqual([
      'member',
      'member',
      'member',
      'vacant',
      'vacant',
    ])
  })

  it('shows a member their image, and their initials when the image fails', () => {
    render(<SquadCard squad={{ ...openSquad, memberCount: 2, memberPreview: previewMembers(2) }} />)

    const guest = screen.getByRole('img', { name: 'Guest 1' })
    const image = guest.querySelector('img')
    expect(image).not.toBeNull()
    expect(screen.getByText('MI')).toBeInTheDocument()

    fireEvent.error(image!)

    expect(within(guest).getByText('G1')).toBeInTheDocument()
    expect(within(guest).queryByRole('img')).not.toBeInTheDocument()
  })

  it('fills the circles a short preview does not reach with a neutral circle', () => {
    render(
      <SquadCard
        squad={{ ...openSquad, maxPlayers: 5, memberCount: 4, memberPreview: previewMembers(2) }}
      />
    )

    expect(memberAvatars()).toHaveLength(2)
    expect(railKinds(screen.getByRole('button'))).toEqual([
      'member',
      'member',
      'filled',
      'filled',
      'vacant',
    ])
  })

  it('caps the rail at five circles and counts the other slots as +N', () => {
    render(
      <SquadCard
        squad={{ ...openSquad, maxPlayers: 10, memberCount: 8, memberPreview: previewMembers(5) }}
      />
    )

    expect(memberAvatars()).toHaveLength(5)
    expect(railKinds(screen.getByRole('button'))).toEqual([
      'member',
      'member',
      'member',
      'member',
      'member',
    ])
    expect(screen.getByText('+5')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('/10')).toBeInTheDocument()
  })

  describe('on a narrow card', () => {
    /** jsdom has no layout: the rail gets `railWidth` and each circle 28px. */
    function layOutRail(railWidth: number) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get(this: HTMLElement) {
          return this.hasAttribute('data-rail-circle') ? 28 : 0
        },
      })
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get(this: HTMLElement) {
          return this.querySelector('[data-rail-circle]') && this.classList.contains('flex-1')
            ? railWidth
            : 0
        },
      })
    }

    afterEach(() => {
      Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth')
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
    })

    it('shows fewer whole circles and folds the rest into +N, keeping the count', () => {
      layOutRail(110)
      render(
        <SquadCard squad={{ ...openSquad, memberCount: 3, memberPreview: previewMembers(3) }} />
      )

      expect(screen.getByRole('button').querySelectorAll('.ring-card')).toHaveLength(2)
      expect(screen.getByText('+3')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('/5')).toBeInTheDocument()
    })

    it('adds the circles that do not fit to the slots past the rail', () => {
      layOutRail(150)
      render(
        <SquadCard
          squad={{ ...openSquad, maxPlayers: 10, memberCount: 8, memberPreview: previewMembers(5) }}
        />
      )

      expect(screen.getByRole('button').querySelectorAll('.ring-card')).toHaveLength(4)
      expect(screen.getByText('+6')).toBeInTheDocument()
    })

    it('shows every circle and no +N when the rail has the room', () => {
      layOutRail(200)
      render(<SquadCard squad={openSquad} />)

      expect(screen.getByRole('button').querySelectorAll('.ring-card')).toHaveLength(5)
      expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument()
    })
  })

  it('shows no +N when every slot has a circle', () => {
    render(<SquadCard squad={openSquad} />)

    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument()
  })
})

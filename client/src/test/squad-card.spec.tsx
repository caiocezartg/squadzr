/**
 * Tests for the SquadCard (CCC-40 r4–r6, CCC-79, CCC-109, #203).
 *
 * The card is part of the server HTML of the Squad Board, so it must be visible before any script
 * runs and through hydration: it never starts at zero opacity, and nothing animates it on mount. Its
 * three states are a link to the Lobby for a member, a button that joins for an open Squad, and a
 * disabled card for a full Squad. Tests find the card by its role and accessible name. The viewer's
 * own seat leads a member's rail, and a live join fills its seat only when the count rises on a card
 * already mounted.
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
import { signInAsFakeUser } from './stubs'

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
const MEMBER_NAME = 'Casual five stack — League of Legends, PT-BR, 3 of 4 players'

function memberAvatars(): HTMLElement[] {
  return screen.getAllByRole('img', { name: /^(Mia|Guest \d)$/ })
}

/** The others' circles of the rail, in order: every one carries `data-rail-circle`. */
function railCircles(card: HTMLElement): HTMLElement[] {
  return Array.from(card.querySelectorAll<HTMLElement>('[data-rail-circle]'))
}

/**
 * The others' circles of the rail, in order, as what each one draws: a member (a named avatar), a
 * neutral filled circle, or a vacant one. The filled and vacant circles are decorative, so they have
 * no role.
 */
function railKinds(card: HTMLElement): Array<'member' | 'filled' | 'vacant'> {
  return railCircles(card).map((circle) => {
    if (circle.querySelector('[role="img"]')) return 'member'
    return circle.querySelector('.bg-faint') ? 'filled' : 'vacant'
  })
}

function viewerSeat(card: HTMLElement): HTMLElement {
  const seat = card.querySelector<HTMLElement>('[data-viewer-seat]')
  if (!seat) throw new Error('No viewer seat')
  return seat
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

  it('lights through the card variant, which hovers for fine pointers only, never plain hover', () => {
    render(<SquadCard squad={openSquad} />)

    const card = screen.getByRole('button', { name: OPEN_NAME })
    expect(card).toHaveAttribute('data-lit-card')
    expect(card.className).toContain('motion-safe:card-lit:scale-[1.02]')
    expect(card.className).not.toMatch(/(^|\s)hover:/)
  })

  it('shows no call to action, badge or ring on any card', () => {
    signInAsFakeUser()
    render(
      <>
        <SquadCard squad={openSquad} />
        <SquadCard squad={memberSquad} />
      </>
    )

    expect(screen.queryByText(/^(Enter|Open room|Joined)$/)).not.toBeInTheDocument()
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
    expect(within(card).getByText('Ranked grind')).toHaveClass('line-clamp-2', 'font-hero')
    expect(within(card).getByText('3')).toBeInTheDocument()
    expect(within(card).getByText('/5')).toBeInTheDocument()
  })

  it('shows the platform chip right after the language, and names it on the card', () => {
    render(<SquadCard squad={{ ...openSquad, platform: 'ps5' }} />)

    const card = screen.getByRole('button', {
      name: 'Ranked grind — League of Legends, EN-US, PS5, 1 of 5 players',
    })
    const language = within(card).getByText('EN-US')
    const platform = within(card).getByText('PS5')
    expect(language.nextElementSibling).toBe(platform)
    expect(platform.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows no platform chip for a squad without a platform', () => {
    render(<SquadCard squad={openSquad} />)

    const card = screen.getByRole('button', { name: OPEN_NAME })
    expect(within(card).queryByText(/^(PC|PS5|PS4|Xbox|Switch|Mobile)/)).not.toBeInTheDocument()
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

describe('squad card — poster and ground', () => {
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

  it('draws the blurred cover behind the card, decorative', () => {
    render(<SquadCard squad={openSquad} />)

    const ground = screen.getByRole('button').querySelector<HTMLElement>('[data-card-ground]')
    expect(ground).toHaveAttribute('aria-hidden', 'true')
    expect(ground?.style.backgroundImage).toContain(openSquad.game.coverUrl)
  })

  it('spills the game colour under an open or member card, but not under a full card', () => {
    signInAsFakeUser()
    render(
      <>
        <SquadCard squad={openSquad} />
        <SquadCard squad={memberSquad} />
        <SquadCard squad={fullSquad} />
      </>
    )

    const [open, full] = screen.getAllByRole('button')
    expect(open!.querySelector('[data-card-glow]')).not.toBeNull()
    expect(screen.getByRole('link').querySelector('[data-card-glow]')).not.toBeNull()
    expect(full!.querySelector('[data-card-glow]')).toBeNull()
  })
})

describe('squad card — member', () => {
  it('is a link to the Lobby', () => {
    signInAsFakeUser()
    const onJoin = vi.fn()
    render(<SquadCard squad={memberSquad} onJoin={onJoin} />)

    const card = screen.getByRole('link', { name: MEMBER_NAME })
    expect(card).toHaveAttribute('href', '/squads/MEM111')
    expect(card).toHaveAttribute('data-lit-card')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('stays a link to the Lobby when the Squad is full', () => {
    render(<SquadCard squad={{ ...fullSquad, isMember: true }} />)

    expect(
      screen.getByRole('link', { name: 'Full lobby — Counter-Strike 2, PT-BR, 4 of 4 players' })
    ).toHaveAttribute('href', '/squads/XYZ789')
  })

  it('seats the viewer first, out of their place in the preview, and turns the count mint', () => {
    signInAsFakeUser({ id: 'guest-2', name: 'Caio' })
    render(<SquadCard squad={memberSquad} />)

    const card = screen.getByRole('link', { name: MEMBER_NAME })
    expect(within(viewerSeat(card)).getByRole('img', { name: 'Caio' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Guest 2' })).not.toBeInTheDocument()
    expect(railKinds(card)).toEqual(['member', 'member', 'vacant'])
    expect(memberAvatars().map((avatar) => avatar.getAttribute('aria-label'))).toEqual([
      'Mia',
      'Guest 1',
    ])
    expect(within(card).getByText('3').closest('.text-mint')).not.toBeNull()
  })

  it('seats a viewer the five-member preview does not reach, in a ten-player Squad', () => {
    signInAsFakeUser({ id: 'user-1', name: 'Caio' })
    render(
      <SquadCard
        squad={{ ...memberSquad, maxPlayers: 10, memberCount: 7, memberPreview: previewMembers(5) }}
      />
    )

    const card = screen.getByRole('link')
    expect(within(viewerSeat(card)).getByRole('img', { name: 'Caio' })).toBeInTheDocument()
    expect(railKinds(card)).toEqual(['member', 'member', 'member', 'member'])
    expect(screen.getByText('+5')).toBeInTheDocument()
    expect(within(card).getByText('7').closest('.text-mint')).not.toBeNull()
  })

  it('seats a mint "you" when there is no session to draw the viewer from', () => {
    render(<SquadCard squad={memberSquad} />)

    const card = screen.getByRole('link', { name: MEMBER_NAME })
    expect(within(viewerSeat(card)).getByText('YOU')).toBeInTheDocument()
    expect(railKinds(card)).toEqual(['member', 'member', 'vacant'])
  })
})

describe('squad card — non-member, open', () => {
  it('is a button that runs the join workflow with the Squad code', () => {
    const onJoin = vi.fn()
    render(<SquadCard squad={openSquad} onJoin={onJoin} />)

    fireEvent.click(screen.getByRole('button', { name: OPEN_NAME }))

    expect(onJoin).toHaveBeenCalledTimes(1)
    expect(onJoin).toHaveBeenCalledWith('ABC123')
  })

  it("keeps the viewer's seat folded at the front for the hover, with the count's next step", () => {
    signInAsFakeUser({ name: 'Caio' })
    render(<SquadCard squad={{ ...openSquad, memberCount: 2, memberPreview: previewMembers(2) }} />)

    const card = screen.getByRole('button')
    const seat = viewerSeat(card)
    expect(seat).toHaveAttribute('aria-hidden', 'true')
    expect(seat).toHaveClass('w-0', 'card-lit:w-7')
    expect(seat).toHaveTextContent('CA')
    // The last drawn circle folds as the seat opens, so the rail keeps its width.
    const circles = railCircles(card)
    expect(circles).toHaveLength(5)
    expect(circles.map((circle) => circle.classList.contains('card-lit:w-0'))).toEqual([
      false,
      false,
      false,
      false,
      true,
    ])
    expect(within(card).getByText('2')).not.toHaveAttribute('aria-hidden')
    expect(within(card).getByText('3')).toHaveAttribute('aria-hidden', 'true')
    expect(within(card).getByText('2').closest('.text-mint')).toBeNull()
  })

  it('opens the mint "you" for a signed-out viewer', () => {
    render(<SquadCard squad={openSquad} />)

    expect(viewerSeat(screen.getByRole('button'))).toHaveTextContent('YOU')
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
  it('is not interactive, with the Full overlay, a grayscale poster and a grey ground', () => {
    const onJoin = vi.fn()
    render(<SquadCard squad={fullSquad} onJoin={onJoin} />)

    const card = screen.getByRole('button', {
      name: 'Full lobby — Counter-Strike 2, PT-BR, 4 of 4 players',
    })
    expect(card).toHaveAttribute('aria-disabled', 'true')
    expect(within(card).getByText('Full')).toHaveClass('font-hero')
    expect(within(card).getByRole('img', { name: 'Counter-Strike 2' })).toHaveClass('grayscale')
    expect(card.querySelector('[data-card-ground]')).toHaveClass('grayscale', 'opacity-35')
    expect(card).not.toHaveAttribute('data-lit-card')
    expect(card.querySelector('[data-viewer-seat]')).toBeNull()

    fireEvent.click(card)

    expect(onJoin).not.toHaveBeenCalled()
  })
})

describe('squad card — preview', () => {
  it('is a plain group, not a link or a button', () => {
    const onJoin = vi.fn()
    render(<SquadCard squad={{ ...openSquad, code: '••••••' }} onJoin={onJoin} preview />)

    const card = screen.getByRole('group', {
      name: 'Ranked grind — League of Legends, EN-US, 1 of 5 players',
    })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(within(card).getByText('#••••••')).toBeInTheDocument()
    expect(within(card).getByText('Ranked grind')).toBeInTheDocument()

    fireEvent.click(card)

    expect(onJoin).not.toHaveBeenCalled()
  })

  it('is not an action the viewer can focus or press', () => {
    render(<SquadCard squad={openSquad} preview />)

    const card = screen.getByRole('group')
    expect(card).not.toHaveAttribute('tabindex')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it("draws no viewer seat, no hover and no glow, even for the viewer's own Squad", () => {
    signInAsFakeUser({ id: 'user-9' })
    render(<SquadCard squad={{ ...openSquad, isMember: true }} preview />)

    const card = screen.getByRole('group')
    expect(card).not.toHaveAttribute('data-lit-card')
    expect(card.querySelector('[data-viewer-seat]')).toBeNull()
    expect(card.querySelector('[data-card-glow]')).toBeNull()
    expect(railKinds(card)).toEqual(['member', 'vacant', 'vacant', 'vacant', 'vacant'])
  })

  it('shows its one member as a member, never as a full Squad', () => {
    render(<SquadCard squad={{ ...openSquad, maxPlayers: 2, memberCount: 1 }} preview />)

    const card = screen.getByRole('group')
    expect(within(card).queryByText('Full')).not.toBeInTheDocument()
    expect(within(card).getByText('/2')).toBeInTheDocument()
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
    /** jsdom has no layout: the rail gets `railWidth`, each circle 28px, the viewer's seat too. */
    function layOutRail(railWidth: number) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get(this: HTMLElement) {
          if (this.hasAttribute('data-rail-viewer-face')) return 28
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

      expect(railCircles(screen.getByRole('button'))).toHaveLength(2)
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

      expect(railCircles(screen.getByRole('button'))).toHaveLength(4)
      expect(screen.getByText('+6')).toBeInTheDocument()
    })

    it("fits a member's seat as one more circle, and never folds the viewer", () => {
      signInAsFakeUser({ name: 'Caio' })
      layOutRail(110)
      render(
        <SquadCard
          squad={{
            ...memberSquad,
            maxPlayers: 5,
            memberCount: 4,
            memberPreview: previewMembers(4),
          }}
        />
      )

      const card = screen.getByRole('link')
      expect(viewerSeat(card)).toBeInTheDocument()
      expect(railCircles(card)).toHaveLength(1)
      expect(screen.getByText('+3')).toBeInTheDocument()
    })

    it('shows every circle and no +N when the rail has the room', () => {
      layOutRail(200)
      render(<SquadCard squad={openSquad} />)

      expect(railCircles(screen.getByRole('button'))).toHaveLength(5)
      expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument()
    })
  })

  it('shows no +N when every slot has a circle', () => {
    render(<SquadCard squad={openSquad} />)

    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument()
  })
})

describe('squad card — live arrival', () => {
  function squadWith(memberCount: number, overrides: Partial<Squad> = {}): Squad {
    return { ...openSquad, memberCount, memberPreview: previewMembers(memberCount), ...overrides }
  }

  function arrivingSeats(card: HTMLElement): number[] {
    return railCircles(card).flatMap((circle, index) =>
      circle.hasAttribute('data-arriving') ? [index] : []
    )
  }

  function countSteps(card: HTMLElement): HTMLElement[] {
    return Array.from(card.querySelectorAll<HTMLElement>('[class*="animate-card-count-step"]'))
  }

  function seatFill(circle: HTMLElement): HTMLElement | null {
    return circle.querySelector<HTMLElement>('[class*="animate-card-seat-fill"]')
  }

  it("fills the new member's seat with the pop and the outline, and rolls the count", () => {
    const { rerender } = render(<SquadCard squad={squadWith(1)} />)
    rerender(<SquadCard squad={squadWith(2)} />)

    const card = screen.getByRole('button')
    expect(arrivingSeats(card)).toEqual([1])
    const seat = railCircles(card)[1]!
    expect(within(seat).getByRole('img', { name: 'Guest 1' })).toBeInTheDocument()
    expect(seatFill(seat)).not.toBeNull()
    expect(seat.querySelector('[class*="animate-card-seat-ping"]')).not.toBeNull()
    expect(countSteps(card)).toHaveLength(1)
    expect(within(card).getByText('2')).not.toHaveAttribute('aria-hidden')
    expect(animateCalls).toHaveLength(0)
  })

  it('never plays on mount', () => {
    render(<SquadCard squad={squadWith(3)} />)

    const card = screen.getByRole('button')
    expect(arrivingSeats(card)).toEqual([])
    expect(countSteps(card)).toHaveLength(0)
  })

  it('never plays on a StrictMode mount', () => {
    render(
      <StrictMode>
        <SquadCard squad={squadWith(3)} />
      </StrictMode>
    )

    expect(arrivingSeats(screen.getByRole('button'))).toEqual([])
  })

  it('fills two new seats in turn, 250ms apart, and rolls the count one step per seat', () => {
    const { rerender } = render(<SquadCard squad={squadWith(1)} />)
    rerender(<SquadCard squad={squadWith(3)} />)

    const card = screen.getByRole('button')
    expect(arrivingSeats(card)).toEqual([1, 2])
    const delays = railCircles(card)
      .slice(1, 3)
      .map((circle) => seatFill(circle)?.style.animationDelay)
    expect(delays).toEqual(['0ms', '250ms'])
    expect(countSteps(card)).toHaveLength(2)
  })

  it('only rolls the count when the new seat is folded into +N', () => {
    const big = (count: number) => squadWith(count, { maxPlayers: 10 })
    const { rerender } = render(<SquadCard squad={big(6)} />)
    rerender(<SquadCard squad={big(7)} />)

    const card = screen.getByRole('button')
    expect(arrivingSeats(card)).toEqual([])
    expect(countSteps(card)).toHaveLength(1)
  })

  it("does not play for the viewer's own join", () => {
    const { rerender } = render(<SquadCard squad={squadWith(1)} />)
    rerender(<SquadCard squad={squadWith(2, { isMember: true })} />)

    const card = screen.getByRole('link')
    expect(arrivingSeats(card)).toEqual([])
    expect(countSteps(card)).toHaveLength(0)
  })

  it('empties a seat with no animation when a member leaves', () => {
    const { rerender } = render(<SquadCard squad={squadWith(3)} />)
    rerender(<SquadCard squad={squadWith(2)} />)

    const card = screen.getByRole('button')
    expect(arrivingSeats(card)).toEqual([])
    expect(railKinds(card)).toEqual(['member', 'member', 'vacant', 'vacant', 'vacant'])
  })

  it('never plays on a preview', () => {
    const { rerender } = render(<SquadCard squad={squadWith(1)} preview />)
    rerender(<SquadCard squad={squadWith(2)} preview />)

    expect(arrivingSeats(screen.getByRole('group'))).toEqual([])
  })
})

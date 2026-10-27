'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { SearchField } from '@/components/ds/search-field'
import type { Game } from '@/types'
import { GameOption } from './game-option'
import { searchGames } from './search-games'
import { useDebouncedValue } from './use-debounced-value'

/** How long the player's typing settles before the search asks the server. */
const SEARCH_DEBOUNCE_MS = 250

/** Stable empty list, so the effects keep one reference while the search loads. */
const NO_GAMES: Game[] = []

export interface GameStepProps {
  /** The game the form currently holds. */
  selectedGame: Game | null
  onSelect: (game: Game) => void
  /**
   * Tells the dialog whether the list owns the next Escape, i.e. it is open. The dialog then cancels its own
   * dismissal, so the first Escape reaches the list
   * without depending on event propagation (see CreateSquadDialog).
   */
  onEscapeOwnerChange: (owns: boolean) => void
}

/**
 * Step 1 of the create-Squad wizard: an ARIA combobox backed by `GET /api/games`. The list shows the
 * popular games while the field is empty and the matches while it is not; the input owns the
 * keyboard (arrows, Enter, Escape) and a live region announces how many games the search found.
 * Arrow keys move the active option without a transition.
 */
export function GameStep({ selectedGame, onSelect, onEscapeOwnerChange }: GameStepProps) {
  const t = useTranslations()
  const listboxId = useId()

  const [query, setQuery] = useState('')
  // The list is the step's content, so it starts open; Escape closes it and typing reopens it.
  const [open, setOpen] = useState(true)
  const [activeIndex, setActiveIndex] = useState(-1)
  // Only the keyboard scrolls the highlighted option into view; a hover highlight scrolling the list
  // under the pointer would move the next option under it and chase the pointer down the list.
  const scrollActiveIntoView = useRef(false)

  const searchTerm = query.trim()
  const debouncedTerm = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS)

  const gamesQuery = useQuery({
    queryKey: ['games', 'search', debouncedTerm],
    queryFn: ({ signal }) => searchGames(debouncedTerm, signal),
    // The player keeps reading the previous results while the next term loads;
    // TanStack Query cancels the superseded request once its query loses this
    // observer, so a term the player moved past no longer costs a response.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
  const games = gamesQuery.data ?? NO_GAMES

  // The live region follows the fetch, but the list only shows the searching
  // state when it has nothing to list yet.
  const showsSearching = games.length === 0 && gamesQuery.isFetching
  const showsEmpty = games.length === 0 && !gamesQuery.isFetching && !gamesQuery.isPlaceholderData

  // The live region follows the same settled/placeholder rule as the empty
  // copy, so an empty placeholder is never announced as "No games found".
  const statusMessage = gamesQuery.isFetching
    ? t('squads.createModal.searchingGames')
    : showsEmpty
      ? t('squads.createModal.noGamesFound')
      : games.length > 0
        ? t('squads.createModal.gamesFound', { count: games.length })
        : ''

  // A new result set starts with nothing highlighted; the first ArrowDown picks it.
  useEffect(() => {
    setActiveIndex(-1)
  }, [games])

  // While the list is open it owns the next Escape, wherever focus is in the dialog.
  const ownsEscape = open
  useEffect(() => {
    onEscapeOwnerChange(ownsEscape)
    // The step unmounts when the wizard moves on; it must not keep owning Escape.
    return () => onEscapeOwnerChange(false)
  }, [onEscapeOwnerChange, ownsEscape])

  // The first Escape closes the open list. The dialog cancels its own Escape dismissal while the
  // list owns it (CreateSquadDialog), so the dialog stays open without relying on event
  // propagation, whether or not focus is in the search.
  useEffect(() => {
    if (!open) return

    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape, true)
    return () => window.removeEventListener('keydown', closeOnEscape, true)
  }, [open])

  // Keep the highlighted option visible while the player moves with the keyboard.
  useEffect(() => {
    if (!open || activeIndex < 0 || !scrollActiveIntoView.current) return
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView?.({
      block: 'nearest',
    })
  }, [activeIndex, listboxId, open])

  const optionId = (index: number) => `${listboxId}-option-${index}`

  const handleQueryChange = (next: string) => {
    setQuery(next)
    setActiveIndex(-1)
    setOpen(true)
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (games.length === 0) return
      scrollActiveIntoView.current = true
      const down = event.key === 'ArrowDown'
      setActiveIndex((index) =>
        down ? (index < 0 ? 0 : Math.min(index + 1, games.length - 1)) : Math.max(index - 1, 0)
      )
      return
    }

    if (event.key === 'Enter' && open) {
      const game = games[activeIndex]
      // Without an active option Enter falls through to the form, which continues.
      if (game) {
        event.preventDefault()
        onSelect(game)
      }
    }
  }

  const question = t('ds.createSquad.gameQuestion')
  const showsPopular = debouncedTerm === '' && games.length > 0

  return (
    <div className="flex flex-col gap-3.5 max-sm:min-h-0 max-sm:flex-1">
      <div className="flex flex-col gap-2.5">
        <p aria-hidden className="text-[15px] font-bold">
          {question}
        </p>
        <SearchField
          label={question}
          value={query}
          onChange={handleQueryChange}
          combobox={{ expanded: open, controls: listboxId }}
          placeholder={t('ds.createSquad.searchPlaceholder')}
          aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          onKeyDown={handleInputKeyDown}
          onClick={() => setOpen(true)}
        />
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {open ? statusMessage : ''}
      </p>

      {open && (
        <div className="flex flex-col gap-2.5 max-sm:min-h-0 max-sm:flex-1">
          {showsPopular && (
            <p className="type-label text-text-3 tracking-[0.12em]">
              {t('ds.createSquad.popular')}
            </p>
          )}
          <ul
            id={listboxId}
            role="listbox"
            aria-label={t('ds.createSquad.results')}
            className="scrollbar-thin m-0 flex list-none max-sm:min-h-0 sm:max-h-96 flex-col gap-0.5 overflow-y-auto p-0"
          >
            {games.map((game, index) => (
              <GameOption
                key={game.id}
                id={optionId(index)}
                game={game}
                term={debouncedTerm}
                selected={selectedGame?.id === game.id}
                active={index === activeIndex}
                onSelect={() => onSelect(game)}
                onHover={() => {
                  scrollActiveIntoView.current = false
                  setActiveIndex(index)
                }}
              />
            ))}
          </ul>
          {showsSearching && (
            <p className="text-text-3 text-sm">{t('squads.createModal.searchingGames')}</p>
          )}
          {showsEmpty && (
            <div className="bg-bg flex flex-col items-start gap-2 p-5.5">
              <span className="text-[15px] font-bold">
                {debouncedTerm === ''
                  ? t('squads.createModal.noGamesFound')
                  : t('ds.createSquad.emptyTitle', { term: debouncedTerm })}
              </span>
              <span className="text-text-3 text-[13px] leading-normal">
                {t('ds.createSquad.emptyBody')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

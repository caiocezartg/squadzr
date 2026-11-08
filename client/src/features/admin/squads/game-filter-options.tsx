'use client'

import { useId, useState, type KeyboardEvent } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { GAME_SEARCH_MAX_LENGTH } from '@squadzr/schemas'
import { SearchField } from '@/components/ds/search-field'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { searchGames } from '@/lib/search-games'
import { cn } from '@/lib/utils'
import type { Game } from '@/types'

/** How long the typing settles before the search asks the server. */
const SEARCH_DEBOUNCE_MS = 250

/** The picked Game, or `null` for every Game. */
export type GamePick = Pick<Game, 'id' | 'name'> | null

interface GameFilterOptionsProps {
  /** The Game the list keeps now; empty is every Game. */
  readonly gameId: string
  readonly onPick: (game: GamePick) => void
}

/**
 * The game filter's content: a combobox over `GET /api/games`, "All games" first, then the popular
 * games while the field is empty and the matches while it is not. The input owns the keyboard: the
 * arrows move the active option and Enter picks it.
 */
export function GameFilterOptions({ gameId, onPick }: GameFilterOptionsProps) {
  const t = useTranslations('admin.squads.gameFilter')
  const listboxId = useId()
  const [term, setTerm] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const debouncedTerm = useDebouncedValue(term.trim(), SEARCH_DEBOUNCE_MS)
  const gamesQuery = useQuery({
    queryKey: ['games', 'search', debouncedTerm],
    queryFn: ({ signal }) => searchGames(debouncedTerm, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
  const options: readonly GamePick[] = [null, ...(gamesQuery.data ?? [])]
  const optionId = (index: number) => `${listboxId}-option-${index}`

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const down = event.key === 'ArrowDown'
      setActiveIndex((index) =>
        down ? Math.min(index + 1, options.length - 1) : Math.max(index - 1, 0)
      )
      return
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      const option = options[activeIndex]
      if (option !== undefined) onPick(option)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchField
        label={t('search')}
        placeholder={t('search')}
        value={term}
        onChange={(next) => {
          setTerm(next)
          setActiveIndex(-1)
        }}
        combobox={{ expanded: true, controls: listboxId }}
        maxLength={GAME_SEARCH_MAX_LENGTH}
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        onKeyDown={handleKeyDown}
      />
      <ul
        id={listboxId}
        role="listbox"
        aria-label={t('results')}
        aria-busy={gamesQuery.isFetching}
        className="scrollbar-thin m-0 flex max-h-72 list-none flex-col gap-0.5 overflow-y-auto p-0"
      >
        {options.map((game, index) => {
          const selected = (game?.id ?? '') === gameId
          return (
            <li
              key={game?.id ?? 'all'}
              id={optionId(index)}
              role="option"
              aria-selected={selected}
              // Keep focus in the search field.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onPick(game)}
              className={cn(
                'flex min-h-11 cursor-default items-center justify-between gap-3 px-3 text-sm font-semibold',
                index === activeIndex ? 'bg-raised-2 text-text' : 'text-text-2',
                selected && 'text-mint'
              )}
            >
              <span className="min-w-0 break-words">{game ? game.name : t('all')}</span>
              {selected && (
                <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.6} />
              )}
            </li>
          )
        })}
      </ul>
      {gamesQuery.data?.length === 0 && !gamesQuery.isFetching && (
        <p className="text-text-3 text-[13px]">{t('noGames')}</p>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { Game } from '@/types'

/** The name split around the first case-insensitive occurrence of the typed term. */
export function splitMatch(name: string, term: string): [string, string, string] {
  const at = term === '' ? -1 : name.toLowerCase().indexOf(term.toLowerCase())
  if (at < 0) return [name, '', '']
  return [name.slice(0, at), name.slice(at, at + term.length), name.slice(at + term.length)]
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** The cover, or the game's initials when the image does not load. */
function GameCover({ game }: { game: Game }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        data-testid="game-initials"
        className="bg-track text-text-3 font-ds-mono flex h-11 w-8.25 shrink-0 items-center justify-center text-[11px] font-extrabold"
      >
        {initialsOf(game.name)}
      </span>
    )
  }

  return (
    <img
      src={game.coverThumbUrl}
      alt=""
      onError={() => setFailed(true)}
      className="block h-11 w-8.25 shrink-0 object-cover"
    />
  )
}

interface GameOptionProps {
  id: string
  game: Game
  /** The term the shown results answer, highlighted inside the name. */
  term: string
  selected: boolean
  active: boolean
  onSelect: () => void
  onHover: () => void
}

/** One result of the game search: cover, name with the match highlighted, genre and squad size. */
export function GameOption({
  id,
  game,
  term,
  selected,
  active,
  onSelect,
  onHover,
}: GameOptionProps) {
  const t = useTranslations('ds.createSquad')
  const [before, hit, after] = splitMatch(game.name, term)
  const sizes = { min: game.minPlayers, max: game.maxPlayers }
  const genre = game.genres[0]?.name
  const detail = genre ? t('gameDetail', { genre, ...sizes }) : t('gameDetailNoGenre', sizes)

  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      aria-label={t('gameOption', { name: game.name, detail })}
      // Keep focus in the search field.
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={cn(
        'text-text flex min-h-15 cursor-default scroll-my-1 items-center gap-3.5 py-2 pr-3.5 pl-2',
        active ? 'bg-raised-2' : 'hover-fine:bg-raised',
        selected && 'shadow-[inset_2px_0_0_var(--color-mint)]'
      )}
    >
      <GameCover game={game} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="truncate text-[15px] font-bold">
          {before}
          {hit && (
            <mark className="text-mint bg-transparent underline decoration-1 underline-offset-3">
              {hit}
            </mark>
          )}
          {after}
        </span>
        <span className="text-faint truncate text-xs">{detail}</span>
      </span>
      {selected && <Check aria-hidden className="text-mint size-4 shrink-0" strokeWidth={3} />}
    </li>
  )
}

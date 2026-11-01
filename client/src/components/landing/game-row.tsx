import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { PopularGame } from '@/types'
import { gameRange } from './game-range'

interface GameRowProps {
  readonly entry: PopularGame
  readonly featured: boolean
  /** Features the row's game: on hover, focus and press (a tap focuses nothing in Safari). */
  readonly onFeature: () => void
}

/** One row of the games list: thumbnail, name, genre and size range. It features its game. */
export function GameRow({ entry, featured, onFeature }: GameRowProps) {
  const t = useTranslations('landing.games')
  const { game } = entry
  const genre = game.genres[0]?.name
  const range = gameRange(game)
  const label = genre
    ? t('row', { name: game.name, genre, range })
    : t('rowNoGenre', { name: game.name, range })

  return (
    <button
      type="button"
      aria-pressed={featured}
      aria-label={label}
      onMouseEnter={onFeature}
      onFocus={onFeature}
      onClick={onFeature}
      className={cn(
        'text-text focus-visible:outline-mint grid min-h-14.5 w-full cursor-pointer grid-cols-[40px_minmax(0,1fr)_auto_28px] items-center gap-3.5 px-3.5 py-1.5 text-left transition-colors duration-150focus-visible:-outline-offset-2 focus-visible:outline-2 sm:grid-cols-[40px_minmax(0,1fr)_90px_44px]',
        featured ? 'bg-raised' : 'bg-panel hover-fine:bg-[#16171B]'
      )}
    >
      <img
        src={game.coverThumbUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="bg-raised-2 block h-11.5 w-8.5 object-cover"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] font-bold">{game.name}</span>
        {genre && <span className="text-ds-muted truncate text-xs">{genre}</span>}
      </span>
      <span className="font-ds-mono text-text-2 text-[13px] font-bold">{range}</span>
      <span
        aria-hidden="true"
        className={cn(
          'flex size-7 items-center justify-center justify-self-end transition-colors duration-150',
          featured ? 'text-mint' : 'text-[#4A4C54]'
        )}
      >
        <ArrowRight className="size-3.75" strokeWidth={2.6} />
      </span>
    </button>
  )
}

import { Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Tag } from '@/components/ds/tag'
import { useTimeAgo } from '@/hooks/use-time-ago'
import { languageBadgeKey } from '@/lib/language-badge'
import type { PublicSquad } from '@/types'

interface LobbyCoverProps {
  squad: PublicSquad | null
}

/** The mint corner marks that frame the cover (reference, Lobby). */
function CornerMarks() {
  return (
    <>
      <span
        aria-hidden="true"
        className="border-mint/70 absolute -top-1 -left-1 z-10 sm:-top-2.5 sm:-left-2.5 size-6 border-t-2 border-l-2"
      />
      <span
        aria-hidden="true"
        className="border-mint/70 absolute -right-1 -bottom-1 z-10 sm:-right-2.5 sm:-bottom-2.5 size-6 border-r-2 border-b-2"
      />
    </>
  )
}

/**
 * The cover panel (reference, Lobby): the game's cover with its label, the Squad name in display type,
 * the language, the tags and when it was created. It is a poster beside the members panel at wide
 * widths and a 16:9 band above it below them.
 */
export function LobbyCover({ squad }: LobbyCoverProps) {
  const t = useTranslations()
  const timeAgo = useTimeAgo(squad?.createdAt)
  const game = squad?.game

  return (
    <section
      aria-label={t('ds.lobby.aboutSquad')}
      className="relative flex flex-col lg:w-72 lg:shrink-0 xl:w-95"
    >
      <CornerMarks />
      <div className="bg-raised-2 relative flex aspect-video flex-1 flex-col justify-between gap-6 p-4 sm:p-5.5 lg:aspect-3/4">
        <div className="absolute inset-0 overflow-hidden">
          {game?.coverUrl && (
            <img
              src={game.coverUrl}
              alt={t('ds.lobby.coverAlt', { game: game.name })}
              className="absolute inset-0 size-full object-cover"
            />
          )}
          <div aria-hidden="true" className="bg-bg/70 absolute inset-0" />
          <div
            aria-hidden="true"
            className="from-bg/55 absolute inset-0 bg-linear-to-b to-transparent to-25%"
          />
          <div
            aria-hidden="true"
            className="to-bg absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-b from-transparent"
          />
        </div>

        <div className="relative">
          {game && (
            <span className="type-label bg-bg/60 text-text inline-block px-2.25 py-1.5 text-xs">
              {game.name}
            </span>
          )}
        </div>

        <div className="relative flex flex-col gap-3.5">
          <h1 className="font-display text-[30px] leading-[1.02] font-black wrap-anywhere uppercase sm:text-4xl lg:text-[46px]">
            {squad?.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {squad?.language && (
              <Tag variant="lang-light" size="md" label={t(languageBadgeKey(squad.language))} />
            )}
            {squad?.tags.map((tag) => (
              <Tag key={tag} variant="glass" size="md" label={tag} />
            ))}
          </div>
          <p className="text-text-3 flex items-center gap-1.5 text-[13px]">
            <Clock aria-hidden="true" className="size-3.25 stroke-[2.4]" />
            {t('ds.lobby.created', { time: timeAgo })}
          </p>
        </div>
      </div>
    </section>
  )
}

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useTimeAgo } from '@/hooks/use-time-ago'
import { languageBadgeKey } from '@/lib/language-badge'
import { Check, Users } from 'lucide-react'
import type { PublicSquad, Game } from '@/types'

export interface SquadCardProps {
  squad: PublicSquad
  game: Game | undefined
  onJoin?: (squadCode: string) => void
  isLoading?: boolean
}

const COVER_POSITION_Y: Record<string, string> = {
  roblox: '50%',
  minecraft: '25%',
  cs2: '30%',
  fortnite: '10%',
  dota2: '20%',
  lol: '25%',
  pubg: '20%',
  freefire: '20%',
  valorant: '15%',
  warzone: '60%',
  apex: '10%',
  gtaonline: '45%',
  rocketleague: '60%',
  r6siege: '5%',
  amongus: '30%',
  overwatch2: '15%',
  wow: '5%',
  fc25: '5%',
  dbd: '10%',
}

export function SquadCard({ squad, game, onJoin, isLoading }: SquadCardProps) {
  const t = useTranslations()
  const timeAgo = useTimeAgo(squad.createdAt)
  const members = squad.memberCount ?? 1
  const isFull = members >= squad.maxPlayers
  const isDisabled = isLoading || (isFull && !squad.isMember)
  const squadTags = squad.tags ?? []
  const coverUrl = game?.coverUrl ? game.coverUrl : null
  // The card never waits for the network: the cover fades in on its own when
  // it loads, over the placeholder background, and stays hidden if it fails.
  const [loadedCover, setLoadedCover] = useState<string | null>(null)
  const coverLoaded = coverUrl !== null && loadedCover === coverUrl

  // A server-rendered card puts the `<img>` in the HTML, so the browser can finish loading it before
  // React attaches `onLoad`. That load never fires again, so the ref checks the image once attached.
  const markCoverIfAlreadyLoaded = useCallback(
    (img: HTMLImageElement | null) => {
      if (coverUrl && img?.complete && img.naturalWidth > 0) setLoadedCover(coverUrl)
    },
    [coverUrl]
  )

  const MAX_DOTS = 8
  const visibleSlots = Math.min(squad.maxPlayers, MAX_DOTS)
  const extraSlots = squad.maxPlayers > MAX_DOTS ? squad.maxPlayers - MAX_DOTS : 0

  return (
    <button
      type="button"
      onClick={() => onJoin?.(squad.code)}
      disabled={isDisabled}
      className={`group relative w-full overflow-hidden rounded-xl border bg-surface text-left transition-[transform,border-color,box-shadow,filter] duration-300 ease-in-out ${
        isDisabled
          ? 'cursor-not-allowed border-border grayscale opacity-50'
          : 'cursor-pointer border-border hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-[0_6px_32px_rgba(0,255,162,0.07)]'
      }`}
    >
      <div className="relative h-40 overflow-hidden bg-surface-light">
        {coverUrl ? (
          <img
            ref={markCoverIfAlreadyLoaded}
            src={coverUrl}
            alt={game?.name ?? ''}
            className={`h-full w-full object-cover transition-opacity duration-300 ease-out ${
              coverLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              objectPosition: `center ${game?.slug ? (COVER_POSITION_Y[game.slug] ?? '20%') : '20%'}`,
            }}
            loading="lazy"
            onLoad={() => setLoadedCover(coverUrl)}
          />
        ) : (
          <div className="h-full w-full bg-surface-light" />
        )}

        <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-surface/40 to-transparent" />

        {game && (
          <span className="absolute bottom-2 left-3 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-xs">
            {game.name}
          </span>
        )}

        {squad.isMember && (
          <span className="absolute right-3 top-2 flex items-center gap-1 rounded-md border border-accent/20 bg-surface/80 px-2 py-0.5 text-[10px] font-semibold text-accent backdrop-blur-xs">
            <Check className="size-3" />
            {t('squads.card.joined')}
          </span>
        )}

        {!isDisabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
            <span className="font-body text-xl font-bold uppercase tracking-widest text-accent drop-shadow-[0_0_24px_rgba(0,255,162,0.7)]">
              {squad.isMember ? t('squads.card.seeSquad') : t('squads.card.joinSquad')}
            </span>
          </div>
        )}

        {isFull && !squad.isMember && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-lg font-bold uppercase tracking-[0.2em] text-offwhite">
              {t('squads.card.full')}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 px-4 py-3">
        <div>
          <h3 className="truncate font-heading text-base font-bold leading-snug">{squad.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="badge-muted px-1.5 py-0.5 text-[10px]">
              {t(languageBadgeKey(squad.language))}
            </span>
            {squadTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-light">#{squad.code}</span>
          <span className="text-[10px] text-muted/40">|</span>
          <span className="text-[11px] text-muted/50">{timeAgo}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: visibleSlots }).map((_, i) => (
              <span
                key={i}
                className={`size-2.5 shrink-0 rounded-full transition-colors ${
                  i < members
                    ? 'bg-accent shadow-[0_0_6px_rgba(0,255,162,0.3)]'
                    : 'bg-surface-light ring-1 ring-border-light'
                }`}
              />
            ))}
            {extraSlots > 0 && <span className="ml-0.5 text-[10px] text-muted">+{extraSlots}</span>}
          </div>
          <span className="flex items-center gap-1 text-xs text-muted">
            <Users className="size-3" />
            <span className="font-medium text-offwhite">{members}</span>/{squad.maxPlayers}
          </span>
        </div>
      </div>
    </button>
  )
}

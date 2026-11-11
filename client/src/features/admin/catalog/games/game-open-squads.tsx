'use client'

import { useTranslations } from 'next-intl'
import type { AdminSquadDto } from '@squadzr/schemas'
import { AppLink } from '@/components/layout/app-link'
import { Button } from '@/components/ds/button'
import { useSquadMeta } from '../../squads/squad-parts'
import { UserSectionHeading } from '../../users/user-section-heading'
import { UserSquadRow } from '../../users/user-squad-row'
import { adminSquadHref, adminSquadsOfGameHref } from './game-links'

interface GameOpenSquadsProps {
  readonly gameId: string
  /** The newest Open Squads, as many as the server sends. */
  readonly squads: readonly AdminSquadDto[]
  /** How many Open Squads the game has in all. */
  readonly total: number
}

/**
 * The game's Open Squads, newest first, each a link to its side panel on the Squads page. When the
 * game has more than the page lists, a line says so and leads to the Squads page kept to the game.
 */
export function GameOpenSquads({ gameId, squads, total }: GameOpenSquadsProps) {
  const t = useTranslations('admin.catalog.games.detail.openSquads')

  return (
    <section aria-labelledby="admin-game-open-squads">
      <UserSectionHeading id="admin-game-open-squads" caption={t('caption')} title={t('title')} />
      {squads.length === 0 ? (
        <p className="text-muted text-sm font-medium">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {squads.map((squad) => (
            <li key={squad.id}>
              <GameSquadLink squad={squad} />
            </li>
          ))}
        </ul>
      )}
      {total > squads.length && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted text-[12.5px] font-medium">
            {t('showing', { shown: squads.length, total })}
          </p>
          <Button href={adminSquadsOfGameHref(gameId)} variant="link">
            {t('viewAll')}
          </Button>
        </div>
      )}
    </section>
  )
}

function GameSquadLink({ squad }: { readonly squad: AdminSquadDto }) {
  const t = useTranslations('admin.catalog.games.detail.openSquads')
  const meta = useSquadMeta(squad)

  return (
    <AppLink
      href={adminSquadHref(squad.id)}
      className="bg-card press hover-fine:bg-raised focus-visible:outline-mint block p-3 focus-visible:outline-2 focus-visible:-outline-offset-2"
    >
      <UserSquadRow
        coverUrl={squad.game.coverThumbUrl}
        name={squad.name}
        meta={t('meta', {
          meta,
          host: squad.host.name,
          members: squad.memberCount,
          max: squad.maxPlayers,
        })}
        end={<span className="type-code text-faint">#{squad.code}</span>}
      />
    </AppLink>
  )
}

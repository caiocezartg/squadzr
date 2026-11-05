'use client'

import { useTranslations } from 'next-intl'
import type { AdminUserSquadDto } from '@squadzr/schemas'
import { AppLink } from '@/components/layout/app-link'
import { lobbyHref } from '@/lib/squad-links'
import { UserSectionHeading } from './user-section-heading'
import { UserSquadRow } from './user-squad-row'

/** The Open Squads the person is in right now, the hosted ones marked, each a link to its Lobby. */
export function UserOpenSquads({ squads }: { readonly squads: readonly AdminUserSquadDto[] }) {
  const t = useTranslations('admin.users.detail.openSquads')

  return (
    <section aria-labelledby="admin-user-open-squads">
      <UserSectionHeading id="admin-user-open-squads" caption={t('caption')} title={t('title')} />
      {squads.length === 0 ? (
        <p className="text-muted text-sm font-medium">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {squads.map((squad) => (
            <li key={squad.id}>
              <AppLink
                href={lobbyHref(squad.code)}
                className="bg-card press hover-fine:bg-raised focus-visible:outline-mint block p-3 focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <UserSquadRow
                  coverUrl={squad.game.coverThumbUrl}
                  name={
                    <>
                      {squad.name}
                      {squad.isHost && (
                        <span className="type-label text-amber ml-1.5 text-[10px]">
                          {t('host')}
                        </span>
                      )}
                    </>
                  }
                  meta={t('meta', {
                    game: squad.game.name,
                    members: squad.memberCount,
                    max: squad.maxPlayers,
                  })}
                  end={<span className="type-code text-faint">#{squad.code}</span>}
                />
              </AppLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

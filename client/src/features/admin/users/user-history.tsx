'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { AdminUserDetailDto } from '@squadzr/schemas'
import { VIEWER_TIME_ZONE } from '@/hooks/use-time-ago'
import { UserSectionHeading } from './user-section-heading'
import { UserSquadRow } from './user-squad-row'

type UserHistoryProps = Pick<AdminUserDetailDto, 'latestCompleted'>

/** What the person did before: the latest five Squads they completed. */
export function UserHistory({ latestCompleted }: UserHistoryProps) {
  const t = useTranslations('admin.users.detail.history')
  const format = useFormatter()

  return (
    <section aria-labelledby="admin-user-history">
      <UserSectionHeading id="admin-user-history" caption={t('caption')} title={t('title')} />
      {latestCompleted.length === 0 ? (
        <p className="text-muted text-sm font-medium">{t('empty')}</p>
      ) : (
        <ul aria-label={t('latest')}>
          {latestCompleted.map((squad) => (
            <li key={squad.id} className="py-3 shadow-[inset_0_1px_0_#16171b]">
              <UserSquadRow
                coverUrl={squad.game.coverThumbUrl}
                name={squad.name}
                meta={t('meta', { game: squad.game.name, count: squad.maxPlayers })}
                end={
                  <time dateTime={squad.readyAt} className="text-text-2 text-[13px] font-medium">
                    {format.dateTime(new Date(squad.readyAt), {
                      dateStyle: 'medium',
                      timeZone: VIEWER_TIME_ZONE,
                    })}
                  </time>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

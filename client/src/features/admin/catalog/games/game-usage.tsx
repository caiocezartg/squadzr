'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { AdminGameUsageDto } from '@squadzr/schemas'
import { StatTile } from '../../overview/stat-tile'

/** How the game is used: its Open Squads right now and its completed Squads, all time. */
export function GameUsage({ usage }: { readonly usage: AdminGameUsageDto }) {
  const t = useTranslations('admin.catalog.games.detail.usage')
  const format = useFormatter()

  return (
    <dl aria-label={t('label')} className="bg-line grid grid-cols-2 gap-px p-px">
      <StatTile label={t('openSquads')} value={format.number(usage.openSquads)}>
        {t('openSquadsNote')}
      </StatTile>
      <StatTile label={t('completedSquads')} value={format.number(usage.completedSquads)}>
        {t('completedSquadsNote')}
      </StatTile>
    </dl>
  )
}

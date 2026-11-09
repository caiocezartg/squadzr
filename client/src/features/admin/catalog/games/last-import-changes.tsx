'use client'

import { useTranslations } from 'next-intl'
import type { AdminGameChangeDto, AdminGamesSummaryDto } from '@squadzr/schemas'
import { AppLink } from '@/components/layout/app-link'
import { RunInstant } from '../run-parts'
import { adminGameHref } from './game-links'
import { GameCount } from './game-parts'

type LastImport = NonNullable<AdminGamesSummaryDto['lastImport']>

/**
 * What the last succeeded Catalog Import changed: when it finished, then the games that entered and
 * left the catalog, each a count with the first few names as links, or a line saying no import has
 * succeeded yet.
 */
export function LastImportChanges({ lastImport }: { readonly lastImport: LastImport | null }) {
  const t = useTranslations('admin.catalog.games.summary')

  return (
    <section
      aria-labelledby="admin-games-last-import"
      className="bg-panel flex min-w-0 flex-col gap-3 px-5 py-4.5 shadow-[inset_0_0_0_1px_var(--color-line)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="admin-games-last-import" className="type-label text-muted">
          {t('lastImport')}
        </h2>
        {lastImport && (
          <span className="text-muted text-[12.5px] font-medium">
            <RunInstant at={lastImport.finishedAt} />
          </span>
        )}
      </div>
      {lastImport === null ? (
        <p className="text-text-3 text-[13.5px] font-medium">{t('noImport')}</p>
      ) : (
        <dl className="grid gap-4 sm:grid-cols-2">
          <GameChange label={t('entered')} change={lastImport.entered} />
          <GameChange label={t('left')} change={lastImport.left} />
        </dl>
      )}
    </section>
  )
}

function GameChange({
  label,
  change,
}: {
  readonly label: string
  readonly change: AdminGameChangeDto
}) {
  const t = useTranslations('admin.catalog.games.summary')
  const more = change.total - change.games.length

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="type-label text-faint text-[10px]">{label}</dt>
      <dd className="font-display text-[26px] leading-none font-extrabold">
        <GameCount value={change.total} />
      </dd>
      {change.games.length > 0 && (
        <dd className="text-text-2 text-[12.5px] font-medium">
          <ul className="flex flex-wrap gap-x-2 gap-y-0.5">
            {change.games.map((game) => (
              <li key={game.id}>
                <AppLink
                  href={adminGameHref(game.id)}
                  className="hover-fine:text-text focus-visible:outline-mint break-words underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {game.name}
                </AppLink>
              </li>
            ))}
            {more > 0 && <li className="text-muted">{t('more', { count: more })}</li>}
          </ul>
        </dd>
      )}
    </div>
  )
}

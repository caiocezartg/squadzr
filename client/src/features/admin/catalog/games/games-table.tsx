'use client'

import { useTranslations } from 'next-intl'
import type { AdminGameDto } from '@squadzr/schemas'
import { AppLink } from '@/components/layout/app-link'
import { SquadThumb } from '../../squads/squad-parts'
import { adminGameHref } from './game-links'
import { useGamesListQuery } from './game-list-links'
import { FeaturedRank, GameCount, GamePlatforms, GamePlayers, GameStatusBadge } from './game-parts'

const HEADER_CELL =
  'type-label text-faint px-2.5 pb-2.5 text-left align-bottom whitespace-nowrap xl:px-3'
// Below xl the long count labels may take two lines, so the table fits the laptop width.
const NUMBER_HEADER_CELL =
  'type-label text-faint px-2.5 pb-2.5 text-right align-bottom xl:px-3 xl:whitespace-nowrap'
const CELL = 'px-2.5 py-3 align-middle xl:px-3 shadow-[inset_0_1px_0_#16171b]'
const NUMBER_CELL = `${CELL} text-right`

/**
 * The games as a table, from 640px up: cover and name, platforms, players, popularity, featured rank,
 * status and usage. The name is the row's link, and it covers the whole row, so a click anywhere opens
 * the game's page.
 */
export function GamesTable({ games }: { readonly games: readonly AdminGameDto[] }) {
  const t = useTranslations('admin.catalog.games')
  const listQuery = useGamesListQuery()

  return (
    <table className="w-full border-collapse text-[13.5px] font-medium">
      <caption className="sr-only">{t('tableLabel')}</caption>
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.game')}
          </th>
          <th scope="col" className={`${HEADER_CELL} max-xl:hidden`}>
            {t('columns.platforms')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.players')}
          </th>
          <th scope="col" className={`${NUMBER_HEADER_CELL} max-xl:hidden`}>
            {t('columns.popularity')}
          </th>
          <th scope="col" className={NUMBER_HEADER_CELL}>
            {t('columns.featured')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.status')}
          </th>
          <th scope="col" className={NUMBER_HEADER_CELL}>
            {t('columns.openSquads')}
          </th>
          <th scope="col" className={NUMBER_HEADER_CELL}>
            {t('columns.completedSquads')}
          </th>
        </tr>
      </thead>
      <tbody className="text-text-2">
        {games.map((game) => (
          <GamesTableRow key={game.id} game={game} listQuery={listQuery} />
        ))}
      </tbody>
    </table>
  )
}

function GamesTableRow({
  game,
  listQuery,
}: {
  readonly game: AdminGameDto
  readonly listQuery: string
}) {
  return (
    <tr className="hover-fine:bg-raised relative h-11">
      <td className={CELL}>
        <span className="flex items-center gap-2.5">
          <SquadThumb url={game.coverThumbUrl} />
          <AppLink
            href={adminGameHref(game.id, listQuery)}
            className="text-text focus-visible:outline-mint min-w-0 font-bold break-words after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {game.name}
          </AppLink>
        </span>
      </td>
      <td className={`${CELL} max-xl:hidden`}>
        <GamePlatforms platforms={game.platforms} />
      </td>
      <td className={CELL}>
        <GamePlayers min={game.minPlayers} max={game.maxPlayers} />
      </td>
      <td className={`${NUMBER_CELL} max-xl:hidden`}>
        <GameCount value={game.popularity} />
      </td>
      <td className={NUMBER_CELL}>
        <FeaturedRank rank={game.featuredRank} />
      </td>
      <td className={CELL}>
        <GameStatusBadge listed={game.listed} />
      </td>
      <td className={NUMBER_CELL}>
        <GameCount value={game.usage.openSquads} />
      </td>
      <td className={NUMBER_CELL}>
        <GameCount value={game.usage.completedSquads} />
      </td>
    </tr>
  )
}

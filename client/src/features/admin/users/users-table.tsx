'use client'

import { useTranslations } from 'next-intl'
import type { AdminUserListItemDto } from '@squadzr/schemas'
import { Avatar } from '@/components/ds/avatar'
import { AppLink } from '@/components/layout/app-link'
import { adminUserHref } from './user-links'
import { DiscordId, JoinedDate, RolePill } from './user-parts'

const HEADER_CELL = 'type-label text-faint px-3 pb-2.5 text-left whitespace-nowrap'
const CELL = 'px-3 py-3 align-middle shadow-[inset_0_1px_0_#16171b]'

/**
 * The users as a table, from 640px up: avatar and name, Discord id, joined date, role and Open Squads.
 * The name is the row's link, and it covers the whole row, so a click anywhere opens the person.
 */
export function UsersTable({ users }: { readonly users: readonly AdminUserListItemDto[] }) {
  const t = useTranslations('admin.users')

  return (
    <table className="w-full border-collapse text-[13.5px] font-medium">
      <caption className="sr-only">{t('tableLabel')}</caption>
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.user')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.discordId')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.joined')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.role')}
          </th>
          <th scope="col" className={`${HEADER_CELL} text-right`}>
            {t('columns.openSquads')}
          </th>
        </tr>
      </thead>
      <tbody className="text-text-2">
        {users.map((user) => (
          <tr key={user.id} className="hover-fine:bg-raised relative h-11">
            <td className={CELL}>
              <span className="flex items-center gap-2.5">
                <Avatar size={28} playerId={user.id} name={user.name} image={user.image} />
                <AppLink
                  href={adminUserHref(user.id)}
                  className="text-text focus-visible:outline-mint font-bold break-words after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {user.name}
                </AppLink>
              </span>
            </td>
            <td className={CELL}>
              <DiscordId discordId={user.discordId} />
            </td>
            <td className={`${CELL} text-muted`}>
              <JoinedDate joinedAt={user.joinedAt} />
            </td>
            <td className={CELL}>
              <RolePill role={user.role} />
            </td>
            <td className={`${CELL} type-counter text-text text-right text-lg`}>
              {user.openSquads}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

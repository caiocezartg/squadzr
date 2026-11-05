'use client'

import { useTranslations } from 'next-intl'
import type { AdminUserListItemDto } from '@squadzr/schemas'
import { Avatar } from '@/components/ds/avatar'
import { AppLink } from '@/components/layout/app-link'
import { adminUserHref } from './user-links'
import { DiscordId, JoinedDate, RolePill } from './user-parts'

/**
 * The users below 640px: one card per person, each a link to their page, with the table's fields
 * stacked under the name. Nothing scrolls sideways.
 */
export function UsersRowList({ users }: { readonly users: readonly AdminUserListItemDto[] }) {
  const t = useTranslations('admin.users')

  return (
    <ul aria-label={t('tableLabel')} className="flex flex-col gap-2">
      {users.map((user) => (
        <li key={user.id}>
          <AppLink
            href={adminUserHref(user.id)}
            className="bg-panel press hover-fine:bg-raised focus-visible:outline-mint flex items-start gap-3 p-3.5 text-[13px] font-medium shadow-[inset_0_0_0_1px_var(--color-line)] focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <Avatar size={34} playerId={user.id} name={user.name} image={user.image} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-start justify-between gap-3">
                <span className="text-text min-w-0 text-sm font-extrabold break-words">
                  {user.name}
                </span>
                <RolePill role={user.role} />
              </span>
              <span className="text-xs">
                <DiscordId discordId={user.discordId} />
              </span>
              <span className="text-muted flex flex-wrap gap-x-2 text-xs">
                <JoinedDate joinedAt={user.joinedAt} />
                <span aria-hidden="true">·</span>
                <span>{t('openSquadsCount', { count: user.openSquads })}</span>
              </span>
            </span>
          </AppLink>
        </li>
      ))}
    </ul>
  )
}

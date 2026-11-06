'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { AdminUserDetailDto } from '@squadzr/schemas'
import { Avatar } from '@/components/ds/avatar'
import { VIEWER_TIME_ZONE } from '@/hooks/use-time-ago'
import { cn } from '@/lib/utils'

/** Who the person is: the big avatar, Discord id, name, the month they joined and whether they are online. */
export function UserIdentity({ user }: { readonly user: AdminUserDetailDto }) {
  const t = useTranslations('admin.users.detail')
  const format = useFormatter()
  const since = format.dateTime(new Date(user.joinedAt), {
    month: 'short',
    year: 'numeric',
    timeZone: VIEWER_TIME_ZONE,
  })

  return (
    <div className="flex items-center gap-4">
      <Avatar size={72} playerId={user.id} name={user.name} image={user.image} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="type-label text-muted break-all">
          {user.discordId === null ? t('noDiscord') : t('discordId', { id: user.discordId })}
        </p>
        <h2 className="font-display text-[36px] leading-none font-black break-words uppercase">
          {user.name}
        </h2>
        <p className="text-muted flex flex-wrap items-center gap-x-1.5 text-[13px] font-medium">
          <span>{t('joined', { date: since })}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                'size-2 rounded-full',
                user.online ? 'bg-mint shadow-[0_0_0_4px_rgba(0,255,162,0.14)]' : 'bg-faint'
              )}
            />
            {user.online ? t('online') : t('offline')}
          </span>
        </p>
      </div>
    </div>
  )
}

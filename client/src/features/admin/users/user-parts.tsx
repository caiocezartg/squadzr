'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { UserRole } from '@squadzr/schemas'
import { VIEWER_TIME_ZONE } from '@/hooks/use-time-ago'
import { cn } from '@/lib/utils'

/** The role as a pill: ADMIN in mint, USER muted. */
export function RolePill({ role }: { readonly role: UserRole }) {
  const t = useTranslations('admin.users.roles')

  return (
    <span
      className={cn(
        'type-label inline-flex px-2 py-1 text-[10.5px] tracking-[0.12em]',
        role === 'admin' ? 'bg-mint text-mint-ink' : 'bg-raised-2 text-muted'
      )}
    >
      {t(role)}
    </span>
  )
}

/** The day the person joined. */
export function JoinedDate({ joinedAt }: { readonly joinedAt: string }) {
  const format = useFormatter()

  return (
    <time dateTime={joinedAt} className="whitespace-nowrap">
      {format.dateTime(new Date(joinedAt), { dateStyle: 'medium', timeZone: VIEWER_TIME_ZONE })}
    </time>
  )
}

/** The Discord id in mono, or a dash for a person without a Discord account. */
export function DiscordId({ discordId }: { readonly discordId: string | null }) {
  const t = useTranslations('admin.users')

  if (discordId === null) {
    return (
      <>
        <span aria-hidden="true" className="text-faint">
          —
        </span>
        <span className="sr-only">{t('noDiscord')}</span>
      </>
    )
  }
  return <span className="type-code text-faint break-all">{discordId}</span>
}

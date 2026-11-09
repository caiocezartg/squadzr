'use client'

import { useTranslations } from 'next-intl'
import type { AdminSquadMemberDto } from '@squadzr/schemas'
import { Avatar } from '@/components/ds/avatar'
import { useTimeAgo } from '@/hooks/use-time-ago'

/** The roster, the host first and marked, each with when they joined. */
export function SquadMembers({ members }: { readonly members: readonly AdminSquadMemberDto[] }) {
  const t = useTranslations('admin.squads.panel')
  const ordered = [...members].sort((a, b) => Number(b.isHost) - Number(a.isHost))

  return (
    <section aria-labelledby="admin-squad-members" className="flex flex-col gap-1.5">
      <h3 id="admin-squad-members" className="type-label text-muted">
        {t('members', { count: members.length })}
      </h3>
      <ul className="flex flex-col">
        {ordered.map((member) => (
          <MemberRow key={member.id} member={member} />
        ))}
      </ul>
    </section>
  )
}

function MemberRow({ member }: { readonly member: AdminSquadMemberDto }) {
  const t = useTranslations('admin.squads.panel')
  const joined = useTimeAgo(member.joinedAt)

  return (
    <li className="flex items-center gap-3 py-2 shadow-[inset_0_-1px_0_#16171b] last:shadow-none">
      <Avatar size={28} playerId={member.id} name={member.name} image={member.image} />
      <span className="text-text flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm font-bold">
        <span className="break-words">{member.name}</span>
        {member.isHost && <span className="type-label text-amber text-[10px]">{t('host')}</span>}
      </span>
      <time dateTime={member.joinedAt} className="text-muted shrink-0 text-xs font-medium">
        {t('joined', { time: joined })}
      </time>
    </li>
  )
}

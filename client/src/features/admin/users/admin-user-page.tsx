'use client'

import { useTranslations } from 'next-intl'
import { grantableRoles, hasFullAdminAccess, type AdminUserDetailDto } from '@squadzr/schemas'
import { useSession } from '@/hooks/use-session'
import { ApiClientError } from '@/lib/api'
import { UserHistory } from './user-history'
import { UserIdentity } from './user-identity'
import { UserLimits } from './user-limits'
import { UserOpenSquads } from './user-open-squads'
import { UserPageHeader } from './user-page-header'
import { UserNotFound, UserPageSkeleton } from './user-page-states'
import { UserRoleControl, UserRoleView } from './user-role-control'
import { useAdminUser } from './users-query'
import { UsersLoadError } from './users-states'

const PANEL = 'bg-panel flex flex-col gap-5.5 p-5 shadow-[inset_0_0_0_1px_var(--color-line)]'

/**
 * One person's page: who they are, their role, their Squad Limits, the Open Squads they are in and
 * what they completed. A person the server or an earlier visit read renders at once; the skeleton is
 * only for one the cache never held.
 */
export function AdminUserPage({ id }: { readonly id: string }) {
  const t = useTranslations('admin.users.detail')
  const query = useAdminUser(id)

  if (query.data) return <UserDetail user={query.data.user} />

  if (query.isError) {
    if (query.error instanceof ApiClientError && query.error.status === 404) {
      return (
        <>
          <UserPageHeader title={t('notFound.title')} />
          <UserNotFound />
        </>
      )
    }
    return (
      <>
        <UserPageHeader title={t('fallbackTitle')} />
        <UsersLoadError message={t('loadError')} onRetry={() => void query.refetch()} />
      </>
    )
  }

  return (
    <>
      <UserPageHeader title={t('fallbackTitle')} />
      <UserPageSkeleton />
    </>
  )
}

function UserDetail({ user }: { readonly user: AdminUserDetailDto }) {
  const viewer = useSession()?.user

  return (
    <>
      <UserPageHeader title={user.name} />
      <div className="grid items-start gap-4.5 lg:grid-cols-[1fr_1.3fr]">
        <section aria-label={user.name} className={PANEL}>
          <UserIdentity user={user} />
          {hasFullAdminAccess(viewer?.role) ? (
            <UserRoleControl
              key={user.id}
              user={user}
              own={user.id === viewer?.id}
              grantable={grantableRoles(viewer?.role, user.role)}
            />
          ) : (
            <UserRoleView role={user.role} />
          )}
          <UserLimits
            squadLimits={user.squadLimits}
            completedSquads={user.completedSquads}
            gamesPlayed={user.gamesPlayed}
          />
        </section>
        <div className={PANEL}>
          <UserOpenSquads squads={user.openSquads} />
          <UserHistory latestCompleted={user.latestCompleted} />
        </div>
      </div>
    </>
  )
}

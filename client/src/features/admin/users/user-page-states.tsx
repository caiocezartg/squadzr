'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { ADMIN_USERS_HREF } from './user-links'
import { UsersEmpty } from './users-states'

/** The page's loading state, only for a person nobody read before: the two panels' places. */
export function UserPageSkeleton() {
  const t = useTranslations('admin.users.detail')

  return (
    <div role="status" aria-label={t('loading')} className="grid gap-4.5 lg:grid-cols-[1fr_1.3fr]">
      <div aria-hidden="true" className="bg-card h-96 animate-pulse" />
      <div aria-hidden="true" className="bg-card h-96 animate-pulse" />
    </div>
  )
}

/** The person does not exist (any more): says so and leads back to the list. */
export function UserNotFound() {
  const t = useTranslations('admin.users.detail')

  return (
    <div className="flex flex-col items-center gap-4">
      <UsersEmpty title={t('notFound.title')} description={t('notFound.description')} />
      <Button href={ADMIN_USERS_HREF} variant="secondary">
        {t('back')}
      </Button>
    </div>
  )
}

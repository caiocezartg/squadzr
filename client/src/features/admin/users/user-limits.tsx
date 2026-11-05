'use client'

import { useTranslations } from 'next-intl'
import type { AdminUserDetailDto } from '@squadzr/schemas'
import { SlotMeter } from '@/components/ds/slot-meter'

type Usage = AdminUserDetailDto['squadLimits']['held']

/**
 * The person's Squad Limits against what they use now: Open Squads held (the hosted ones included) and
 * hosted, each as a count and a meter that turns amber when full.
 */
export function UserLimits({ limits }: { readonly limits: AdminUserDetailDto['squadLimits'] }) {
  const t = useTranslations('admin.users.detail.limits')

  return (
    <section aria-labelledby="admin-user-limits" className="flex flex-col gap-2">
      <h3 id="admin-user-limits" className="type-label text-muted">
        {t('title')}
      </h3>
      <dl className="grid grid-cols-2 shadow-[inset_0_0_0_1px_var(--color-line)]">
        <LimitCell label={t('held')} usage={limits.held} />
        <LimitCell label={t('hosted')} usage={limits.hosted} divided />
      </dl>
    </section>
  )
}

function LimitCell({
  label,
  usage,
  divided = false,
}: {
  readonly label: string
  readonly usage: Usage
  readonly divided?: boolean
}) {
  const t = useTranslations('admin.users.detail.limits')

  return (
    <div
      className={divided ? 'px-3.5 py-3 shadow-[inset_1px_0_0_var(--color-line)]' : 'px-3.5 py-3'}
    >
      <dt className="type-label text-muted text-[10px]">{label}</dt>
      <dd className="mt-1.5 flex flex-col gap-2">
        <span className="text-text text-sm font-bold">
          <span aria-hidden="true">{t('usage', usage)}</span>
          <span className="sr-only">{t('usageLabel', usage)}</span>
        </span>
        <SlotMeter
          variant="pips"
          filled={usage.used}
          total={usage.limit}
          tone={usage.used >= usage.limit ? 'amber' : 'mint'}
        />
      </dd>
    </div>
  )
}

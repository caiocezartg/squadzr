'use client'

import { useTranslations } from 'next-intl'
import type { AdminUserDetailDto } from '@squadzr/schemas'
import { SlotMeter } from '@/components/ds/slot-meter'
import { cn } from '@/lib/utils'

type Usage = AdminUserDetailDto['squadLimits']['held']

type UserLimitsProps = Pick<AdminUserDetailDto, 'squadLimits' | 'completedSquads' | 'gamesPlayed'>

/**
 * The figures under the role, one two-by-two grid as in the mockup: Squads the person completed and the
 * games they played, then the Open Squads they hold (the hosted ones included) and the ones they host
 * against their Squad Limits, each a count and a meter that turns amber when full.
 */
export function UserLimits({ squadLimits, completedSquads, gamesPlayed }: UserLimitsProps) {
  const t = useTranslations('admin.users.detail.limits')

  return (
    <section aria-labelledby="admin-user-limits">
      <h3 id="admin-user-limits" className="sr-only">
        {t('title')}
      </h3>
      <dl className="grid grid-cols-2 shadow-[inset_0_0_0_1px_var(--color-line)]">
        <CountCell label={t('completed')} count={completedSquads} />
        <CountCell label={t('games')} count={gamesPlayed} divided />
        <LimitCell label={t('held')} usage={squadLimits.held} ruled />
        <LimitCell label={t('hosted')} usage={squadLimits.hosted} ruled divided />
      </dl>
    </section>
  )
}

function cellClass(divided: boolean, ruled: boolean): string {
  return cn(
    'px-3.5 py-3',
    divided && 'shadow-[inset_1px_0_0_var(--color-line)]',
    ruled && 'shadow-[inset_0_1px_0_var(--color-line)]',
    divided && ruled && 'shadow-[inset_1px_1px_0_var(--color-line)]'
  )
}

function CountCell({
  label,
  count,
  divided = false,
}: {
  readonly label: string
  readonly count: number
  readonly divided?: boolean
}) {
  return (
    <div className={cellClass(divided, false)}>
      <dt className="type-label text-muted text-[10px]">{label}</dt>
      <dd className="text-text mt-1.5 text-sm font-bold">{count}</dd>
    </div>
  )
}

function LimitCell({
  label,
  usage,
  divided = false,
  ruled = false,
}: {
  readonly label: string
  readonly usage: Usage
  readonly divided?: boolean
  readonly ruled?: boolean
}) {
  const t = useTranslations('admin.users.detail.limits')

  return (
    <div className={cellClass(divided, ruled)}>
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

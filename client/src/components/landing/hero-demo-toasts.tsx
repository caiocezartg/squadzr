'use client'

import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { cn } from '@/lib/utils'
import { DEMO_MEMBERS, type DemoMember } from './hero-demo-data'

interface ToastStyle {
  /** Where the toast stands in the stack: each count has its own row. */
  readonly rowClass: string
  readonly messageKey: 'toastNow' | 'toastOneLeft' | 'toastFull'
  readonly metaClass: string
}

/** The meta line of each toast: the count it announces, in the colour the artboard gives it. */
const TOAST_STYLES: Record<number, ToastStyle> = {
  3: { rowClass: 'top-0', messageKey: 'toastNow', metaClass: 'text-text-3' },
  4: { rowClass: 'top-17', messageKey: 'toastOneLeft', metaClass: 'text-amber' },
  5: { rowClass: 'top-34', messageKey: 'toastFull', metaClass: 'text-mint' },
}

function DemoToast({
  member,
  count,
  visible,
}: {
  readonly member: DemoMember
  readonly count: number
  readonly visible: boolean
}) {
  const t = useTranslations('landing.demo')
  const style = TOAST_STYLES[count]

  return (
    <div
      data-visible={visible ? '' : undefined}
      className={cn(
        'bg-raised-2 absolute inset-x-0 flex h-15 translate-x-3.5 items-center gap-2.5 py-2.5 pr-3.5 pl-2.5 opacity-0',
        'shadow-[0_20px_40px_-12px_rgba(0,0,0,0.8)] transition-[opacity,translate] duration-150 ease-out',
        style?.rowClass,
        'data-visible:translate-x-0 data-visible:opacity-100 data-visible:duration-200'
      )}
    >
      <Avatar size={34} playerId={member.playerId} name={member.name} />
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-bold">{t('toastJoined', { name: member.name })}</span>
        <span className={cn('font-ds-mono text-[11px]', style?.metaClass)}>
          {t(style?.messageKey ?? 'toastNow', { count })}
        </span>
      </div>
    </div>
  )
}

/**
 * The join toasts, one per member that joins. A toast slides in from 14px on the right and, a moment
 * later, leaves the same way (reference, Motion: Hero). Each count has its own row in the stack, so a
 * toast that is leaving is never covered by the next one. Below 640px they are hidden; they only
 * decorate the card.
 */
export function HeroDemoToasts({ visible }: { readonly visible: readonly number[] }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-1.5 right-0 hidden h-15 w-62.5 sm:block lg:-right-6"
    >
      {[3, 4, 5].map((count) => {
        const member = DEMO_MEMBERS[count - 1]
        return member ? (
          <DemoToast key={count} member={member} count={count} visible={visible.includes(count)} />
        ) : null
      })}
    </div>
  )
}

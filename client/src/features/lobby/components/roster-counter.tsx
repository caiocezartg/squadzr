import * as m from 'motion/react-m'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface RosterCounterProps {
  current: number
  max: number
  /** The count swaps its digits with a fade once the viewer is watching live; before, it just reads. */
  live: boolean
  /** A Ready Squad's count reads in mint. */
  ready: boolean
  /** The count is not known yet: its digits pulse as a placeholder until the roster arrives. */
  pending?: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * The big `04/05` counter (reference, Lobby). A changed digit fades in over 150ms. Assistive technology
 * reads the count as a sentence and hears it change.
 */
export function RosterCounter({ current, max, live, ready, pending = false }: RosterCounterProps) {
  const t = useTranslations('ds.lobby')

  return (
    <p
      role="status"
      className="font-display shrink-0 text-[40px] leading-[0.9] font-black tabular-nums sm:text-[56px]"
    >
      <span className="sr-only">
        {pending ? t('loadingMembers') : t('playerCount', { current, max })}
      </span>
      <span aria-hidden="true" className="flex">
        {pending ? (
          <span
            data-testid="roster-counter-skeleton"
            className="bg-track my-[0.05em] w-[1.15em] animate-pulse"
          />
        ) : (
          <CurrentCount current={current} live={live} ready={ready} />
        )}
        <span className="text-[#2e2f36]">/{pad(max)}</span>
      </span>
    </p>
  )
}

function CurrentCount({
  current,
  live,
  ready,
}: Pick<RosterCounterProps, 'current' | 'live' | 'ready'>) {
  return (
    <span className={cn('flex', ready ? 'text-mint' : 'text-text')}>
      {[...pad(current)].map((digit, index) => (
        <m.span
          key={`${index}-${digit}`}
          initial={live ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {digit}
        </m.span>
      ))}
    </span>
  )
}

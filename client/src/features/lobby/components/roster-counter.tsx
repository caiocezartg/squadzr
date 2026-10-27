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
}

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * The big `04/05` counter (reference, Lobby). A changed digit fades in over 150ms. Assistive technology
 * reads the count as a sentence and hears it change.
 */
export function RosterCounter({ current, max, live, ready }: RosterCounterProps) {
  const t = useTranslations('ds.lobby')

  return (
    <p role="status" className="font-display text-[56px] leading-[0.9] font-black tabular-nums">
      <span className="sr-only">{t('playerCount', { current, max })}</span>
      <span aria-hidden="true" className="flex">
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
        <span className="text-[#2e2f36]">/{pad(max)}</span>
      </span>
    </p>
  )
}

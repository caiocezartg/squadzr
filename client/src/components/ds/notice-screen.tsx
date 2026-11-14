import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { SlotMeter } from '@/components/ds/slot-meter'
import { cn } from '@/lib/utils'

/** The empty squad under the copy has this many open seats. */
const EMPTY_SLOTS = 5

/**
 * The glow behind the content. Its alpha falls on a bell curve, so it thins out into the ground with no
 * edge the eye reads as a circle.
 */
const GLOW =
  'radial-gradient(closest-side, rgba(0, 255, 162, 0.0800) 0%, rgba(0, 255, 162, 0.0765) 10%, rgba(0, 255, 162, 0.0668) 20%, rgba(0, 255, 162, 0.0534) 30%, rgba(0, 255, 162, 0.0389) 40%, rgba(0, 255, 162, 0.0260) 50%, rgba(0, 255, 162, 0.0158) 60%, rgba(0, 255, 162, 0.0088) 70%, rgba(0, 255, 162, 0.0045) 80%, rgba(0, 255, 162, 0.0021) 90%, rgba(0, 255, 162, 0.0000) 100%)'

interface NoticeScreenProps {
  /** The large mark the screen is about: "404", or the code the player tried. */
  mark: ReactNode
  title: string
  description: string
  /** The actions under the copy. */
  children?: ReactNode
  /** The screen's height, which the content centres in; it depends on what sits around the screen. */
  className?: string
}

/**
 * A full-height notice that stands in for a page with nothing to show, such as a not-found. It speaks
 * the board's language: a display mark, the panel title, and an empty squad (vacant
 * seats, an unlit meter, `00/05`) that says nobody is here.
 */
export function NoticeScreen({ mark, title, description, children, className }: NoticeScreenProps) {
  return (
    <div
      className={cn(
        'relative isolate flex items-center justify-center overflow-hidden px-4 py-20',
        className
      )}
    >
      <div className="relative flex w-full max-w-xl flex-col items-center text-center">
        {/* A round glow centred on the content, whatever the screen's shape; its stops ease it into the ground. */}
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -z-10 size-[min(1100px,220vw)] -translate-1/2"
          style={{ backgroundImage: GLOW }}
        />
        <div className="max-w-full break-all">{mark}</div>
        <EmptySquad />
        <h1 className="type-panel-title text-text mt-8 text-[32px] sm:text-[40px]">{title}</h1>
        <p className="type-body text-text-3 mt-3 max-w-md">{description}</p>
        {children && (
          <div className="mt-8 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">{children}</div>
        )}
      </div>
    </div>
  )
}

/** A squad with every seat open: decorative, the copy says what happened. */
function EmptySquad() {
  const t = useTranslations('ds.notice')

  return (
    <div
      aria-hidden="true"
      className="bg-panel border-line mt-8 flex w-full max-w-sm items-center gap-4 border px-4 py-3.5"
    >
      <span className="flex gap-1.5">
        {Array.from({ length: EMPTY_SLOTS }, (_, index) => (
          <Avatar key={index} size={28} state="vacant" />
        ))}
      </span>
      <span className="ml-auto flex flex-col items-end gap-1.5">
        <span className="type-label text-muted">{t('emptySlots')}</span>
        <span className="flex items-center gap-2.5">
          <SlotMeter filled={0} total={EMPTY_SLOTS} variant="pips" />
          <span className="type-counter text-faint text-[18px]">
            00/{String(EMPTY_SLOTS).padStart(2, '0')}
          </span>
        </span>
      </span>
    </div>
  )
}

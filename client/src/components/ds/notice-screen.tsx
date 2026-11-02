import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { SlotMeter } from '@/components/ds/slot-meter'

/** The empty squad under the copy has this many open seats. */
const EMPTY_SLOTS = 5

interface NoticeScreenProps {
  /** The mint mono label above the mark, such as "Error 404". */
  eyebrow: string
  /** The large mark the screen is about: "404", or the code the player tried. */
  mark: ReactNode
  title: string
  description: string
  /** The actions under the copy. */
  children?: ReactNode
}

/**
 * A full-height notice that stands in for a page with nothing to show, such as a not-found. It speaks
 * the board's language: a mint eyebrow, a display mark, the panel title, and an empty squad (vacant
 * seats, an unlit meter, `00/05`) that says nobody is here.
 */
export function NoticeScreen({ eyebrow, mark, title, description, children }: NoticeScreenProps) {
  return (
    <div className="relative isolate flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-20">
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_45%_at_50%_40%,rgba(0,255,162,0.06),transparent_70%)]"
      />
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <span className="type-label text-mint flex items-center gap-2">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          {eyebrow}
        </span>
        <div className="mt-4 max-w-full break-all">{mark}</div>
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

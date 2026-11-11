'use client'

import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Platform, RoomLanguage } from '@squadzr/schemas'
import { Popover } from '@/components/ds/popover'
import { cn } from '@/lib/utils'
import { FilterChip } from './filter-chip'
import { PlatformLanguageOptions } from './platform-language-options'

interface PlatformLanguageFilterProps {
  readonly platform: Platform | ''
  readonly language: RoomLanguage | ''
  readonly onPlatformChange: (platform: Platform | '') => void
  readonly onLanguageChange: (language: RoomLanguage | '') => void
}

/**
 * The toolbar's "Filters" chip and the panel it opens (a bottom sheet below 640px) to keep one
 * platform and one Squad language. The chip counts the active ones, the way the board's button does.
 * The panel stays open while the admin picks, since each pick applies at once.
 */
export function PlatformLanguageFilter(props: PlatformLanguageFilterProps) {
  const t = useTranslations('ds.board')
  const [open, setOpen] = useState(false)
  const count = (props.platform ? 1 : 0) + (props.language ? 1 : 0)

  return (
    <Popover
      title={t('panelTitle')}
      hideTitle
      bottomSheet
      align="end"
      open={open}
      onOpenChange={setOpen}
      className="p-5.5 sm:w-105 sm:max-w-[calc(100vw-2rem)]"
      trigger={
        <FilterChip
          open={open}
          active={count > 0}
          label={t('filters')}
          leading={
            <SlidersHorizontal aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.4} />
          }
          trailing={count > 0 && <ActiveCount count={count} open={open} />}
        />
      }
    >
      <PlatformLanguageOptions {...props} />
    </Popover>
  )
}

function ActiveCount({ count, open }: { readonly count: number; readonly open: boolean }) {
  const t = useTranslations('ds.board')

  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'font-mono px-1.5 py-0.5 text-[11px] font-extrabold',
          open ? 'bg-bg text-mint' : 'bg-mint text-mint-ink'
        )}
      >
        {count}
      </span>
      <span className="sr-only">{t('activeFilters', { count })}</span>
    </>
  )
}

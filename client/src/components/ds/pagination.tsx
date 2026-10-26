'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface PaginationProps {
  /** The current page, from 1. */
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** `light` is the Lobby's current page; `mint` is everywhere else. */
  tone?: 'mint' | 'light'
  size?: 'sm' | 'md'
  className?: string
}

/** Previous, numbered pages and next, as square buttons. It renders nothing for a single page. */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  tone = 'mint',
  size = 'md',
  className,
}: PaginationProps) {
  const t = useTranslations('ds.pagination')
  if (pageCount <= 1) return null

  const current = Math.min(pageCount, Math.max(1, page))
  const square = cn('flex items-center justify-center', size === 'sm' ? 'size-10' : 'size-11')
  const control =
    'press focus-visible:outline-text focus-visible:outline-2 focus-visible:outline-offset-2'
  const step = cn(
    square,
    control,
    'bg-raised text-text disabled:text-faint hover-fine:enabled:bg-raised-2 disabled:cursor-default'
  )

  return (
    <nav aria-label={t('label')} className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        aria-label={t('previous')}
        disabled={current === 1}
        onClick={() => onPageChange(current - 1)}
        className={step}
      >
        <ChevronLeft aria-hidden className="size-[15px]" strokeWidth={2.6} />
      </button>
      {Array.from({ length: pageCount }, (_, index) => {
        const number = index + 1
        const isCurrent = number === current

        return (
          <button
            key={number}
            type="button"
            aria-label={t('page', { page: number })}
            aria-current={isCurrent ? 'page' : undefined}
            onClick={() => onPageChange(number)}
            className={cn(
              square,
              control,
              'font-ds-mono font-extrabold',
              size === 'sm' ? 'text-[13px]' : 'text-sm',
              isCurrent
                ? tone === 'light'
                  ? 'bg-text text-bg'
                  : 'bg-mint text-mint-ink'
                : 'bg-raised text-text-2 hover-fine:bg-raised-2'
            )}
          >
            {number}
          </button>
        )
      })}
      <button
        type="button"
        aria-label={t('next')}
        disabled={current === pageCount}
        onClick={() => onPageChange(current + 1)}
        className={step}
      >
        <ChevronRight aria-hidden className="size-[15px]" strokeWidth={2.6} />
      </button>
    </nav>
  )
}

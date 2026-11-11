'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { pageWindow } from './pagination-window'

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

/**
 * Previous, a window of numbered pages and next, as square buttons; from `sm` up the window shows
 * the first, last and current pages with a neighbour each side, and below it a `current / total`
 * count replaces the numbers. It renders nothing for a single page.
 */
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
  const items = pageWindow(current, pageCount)
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
        <ChevronLeft aria-hidden className="size-3.75" strokeWidth={2.6} />
      </button>
      <span
        className={cn(
          'bg-raised text-text-2 flex items-center justify-center px-3 font-mono font-extrabold sm:hidden',
          size === 'sm' ? 'h-10 text-[13px]' : 'h-11 text-sm'
        )}
      >
        {current} / {pageCount}
      </span>
      <div className="hidden items-center gap-1 sm:flex">
        {items.map((item, index) => {
          if (item === 'ellipsis') {
            return (
              <span
                key={`ellipsis-after-${items[index - 1]}`}
                aria-hidden
                data-ellipsis
                className={cn(square, 'text-faint font-mono font-extrabold')}
              >
                …
              </span>
            )
          }

          const isCurrent = item === current

          return (
            <button
              key={item}
              type="button"
              aria-label={t('page', { page: item })}
              aria-current={isCurrent ? 'page' : undefined}
              onClick={() => onPageChange(item)}
              className={cn(
                square,
                control,
                'font-mono font-extrabold',
                size === 'sm' ? 'text-[13px]' : 'text-sm',
                isCurrent
                  ? tone === 'light'
                    ? 'bg-text text-bg'
                    : 'bg-mint text-mint-ink'
                  : 'bg-raised text-text-2 hover-fine:bg-raised-2'
              )}
            >
              {item}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        aria-label={t('next')}
        disabled={current === pageCount}
        onClick={() => onPageChange(current + 1)}
        className={step}
      >
        <ChevronRight aria-hidden className="size-3.75" strokeWidth={2.6} />
      </button>
    </nav>
  )
}

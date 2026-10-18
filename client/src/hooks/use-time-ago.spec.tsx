/**
 * The relative time: the reference time comes from next-intl (the server's request time), the wording
 * is read in the active locale, it refreshes once a minute, and a week-old date is formatted in the
 * active locale.
 */

import { act, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import en from '@/locales/en.json'
import ptBR from '@/locales/pt-BR.json'
import { useTimeAgo } from './use-time-ago'

const NOW = new Date('2026-10-17T12:00:00Z')

function TimeAgo({ date }: { readonly date: Date }) {
  return <span>{useTimeAgo(date)}</span>
}

function renderInLocale(locale: 'en' | 'pt-BR', date: Date) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ptBR} now={NOW}>
      <TimeAgo date={date} />
    </NextIntlClientProvider>
  )
}

describe('useTimeAgo', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads the relative wording in the active locale', () => {
    renderInLocale('en', new Date('2026-10-17T11:55:00Z'))
    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })

  it('reads the relative wording in Portuguese', () => {
    renderInLocale('pt-BR', new Date('2026-10-17T11:55:00Z'))
    expect(screen.getByText('há 5min')).toBeInTheDocument()
  })

  it('formats a date older than a week in the active locale', () => {
    const { unmount } = renderInLocale('en', new Date('2026-10-05T12:00:00Z'))
    expect(screen.getByText('10/5/2026')).toBeInTheDocument()
    unmount()

    renderInLocale('pt-BR', new Date('2026-10-05T12:00:00Z'))
    expect(screen.getByText('05/10/2026')).toBeInTheDocument()
  })

  it('refreshes the wording once a minute', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    renderInLocale('pt-BR', new Date('2026-10-17T11:55:00Z'))
    expect(screen.getByText('há 5min')).toBeInTheDocument()

    // Advancing the fake clock moves `Date` forward as well, so the next tick reads one minute later.
    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(screen.getByText('há 6min')).toBeInTheDocument()
  })
})

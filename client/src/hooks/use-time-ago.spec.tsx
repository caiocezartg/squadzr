/**
 * The relative time: the reference time is the shared clock, seeded with the server's request time, the
 * wording is read in the active locale, the clock refreshes once a minute, and a week-old date is
 * formatted in the active locale.
 */

import { act, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import en from '@/locales/en.json'
import ptBR from '@/locales/pt-BR.json'
import { ClockProvider } from './use-clock'
import { useTimeAgo } from './use-time-ago'

const NOW = new Date('2026-10-17T12:00:00Z')

function TimeAgo({ date }: { readonly date: Date }) {
  return <span>{useTimeAgo(date)}</span>
}

/** The app root's providers: next-intl with the server's request time, then the shared clock. */
function Frame({
  locale,
  children,
}: {
  readonly locale: 'en' | 'pt-BR'
  readonly children?: ReactNode
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ptBR} now={NOW}>
      <ClockProvider>{children}</ClockProvider>
    </NextIntlClientProvider>
  )
}

function renderInLocale(locale: 'en' | 'pt-BR', date: Date) {
  return render(
    <Frame locale={locale}>
      <TimeAgo date={date} />
    </Frame>
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

  it('reads the current time when it mounts after the clock has moved on', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const { rerender } = render(<Frame locale="en" />)

    // The page stays open for two hours before the list mounts, so the shared clock ticks through them.
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 60_000)
    })
    rerender(
      <Frame locale="en">
        <TimeAgo date={new Date('2026-10-17T13:55:00Z')} />
        <TimeAgo date={new Date('2026-10-17T09:00:00Z')} />
      </Frame>
    )

    expect(screen.getByText('5m ago')).toBeInTheDocument()
    expect(screen.getByText('5h ago')).toBeInTheDocument()
  })
})

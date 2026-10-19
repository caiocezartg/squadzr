/**
 * The English messages for the suite. Every render and the non-React translator read the same
 * English file the app ships, so text assertions do not depend on the host machine's language.
 * The React provider also mounts the shared clock and the session provider, as the app root does.
 * The session defaults to the fake auth store's viewer (see ./stubs).
 */

import type { ComponentType, ReactNode } from 'react'
import { NextIntlClientProvider, createTranslator } from 'next-intl'
import type { SessionDto } from '@squadzr/schemas'
import { SessionProvider } from '@/hooks/use-session'
import { ClockProvider } from '@/hooks/use-clock'
import en from '@/locales/en.json'
import { fakeSession } from './stubs'

/** The translator that non-React callers receive in tests. */
export const englishT = createTranslator({ locale: 'en', messages: en })

export function EnglishIntlProvider({
  session = fakeSession(),
  children,
}: {
  /** The session the server would have read for this render; `null` is a signed-out viewer. */
  readonly session?: SessionDto | null
  readonly children: ReactNode
}) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <ClockProvider>
        <SessionProvider initialSession={session}>{children}</SessionProvider>
      </ClockProvider>
    </NextIntlClientProvider>
  )
}

type Wrapper = ComponentType<{ children: ReactNode }>

/** A render's wrapper: the English provider around the render's own wrapper, when it has one. */
export function withEnglishIntl(Inner?: Wrapper): Wrapper {
  return function EnglishIntlWrapper({ children }) {
    return <EnglishIntlProvider>{Inner ? <Inner>{children}</Inner> : children}</EnglishIntlProvider>
  }
}

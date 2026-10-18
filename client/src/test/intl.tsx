/**
 * The English messages for the suite. Every render and the non-React translator read the same
 * English file the app ships, so text assertions do not depend on the host machine's language.
 */

import type { ComponentType, ReactNode } from 'react'
import { NextIntlClientProvider, createTranslator } from 'next-intl'
import en from '@/locales/en.json'

/** The translator that non-React callers receive in tests. */
export const englishT = createTranslator({ locale: 'en', messages: en })

export function EnglishIntlProvider({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {children}
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

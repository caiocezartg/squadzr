import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { LOCALE_COOKIE, type Locale } from './locales'
import { resolveLocale } from './resolve-locale'

// One message file per locale: a request loads only the file it renders.
const MESSAGES = {
  en: () => import('@/locales/en.json'),
  'pt-BR': () => import('@/locales/pt-BR.json'),
} satisfies Record<Locale, () => Promise<unknown>>

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const locale = resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
  })
  const { default: messages } = await MESSAGES[locale]()

  // `now` is the request time: relative times on the client start from the same moment as the HTML.
  return { locale, messages, now: new Date() }
})

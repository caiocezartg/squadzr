import { DEFAULT_LOCALE, localeSchema, type Locale } from './locales'

export interface LocaleInputs {
  /** The raw `NEXT_LOCALE` cookie value, when the request carried one. */
  readonly cookie: string | undefined
  /** The raw `Accept-Language` header, when the request carried one. */
  readonly acceptLanguage: string | null | undefined
}

/**
 * The request's locale: the cookie when it names a supported locale, else the first supported
 * language of `Accept-Language` in preference order, else English. Both inputs are validated
 * against the supported-locale enum before they are used.
 */
export function resolveLocale({ cookie, acceptLanguage }: LocaleInputs): Locale {
  const fromCookie = localeSchema.safeParse(cookie)
  if (fromCookie.success) return fromCookie.data

  for (const tag of parseAcceptLanguage(acceptLanguage ?? '')) {
    const fromHeader = localeSchema.safeParse(localeForTag(tag))
    if (fromHeader.success) return fromHeader.data
  }

  return DEFAULT_LOCALE
}

/**
 * The language ranges of an `Accept-Language` header, most preferred first. A range with quality
 * 0 is refused, and so is the `*` wildcard, so neither is returned.
 */
export function parseAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((entry) => {
      const [tag = '', ...parameters] = entry.split(';')
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith('q='))
      return { tag: tag.trim(), quality: quality === undefined ? 1 : Number(quality.slice(2)) }
    })
    .filter(({ tag, quality }) => tag !== '' && tag !== '*' && quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map(({ tag }) => tag)
}

/** The supported locale for a language tag by its language subtag: `pt-PT` reads `pt-BR`, `en-GB` reads `en`. */
function localeForTag(tag: string): string | undefined {
  const language = tag.toLowerCase().split('-')[0]
  return localeSchema.options.find((locale) => locale.toLowerCase().split('-')[0] === language)
}

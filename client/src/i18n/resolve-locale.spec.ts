/**
 * The locale resolver: the cookie first, then `Accept-Language`, then English. Both inputs are
 * validated against the supported locales, so an unsupported value never reaches the render.
 */

import { describe, expect, it } from 'vitest'
import { resolveLocale } from './resolve-locale'

describe('resolveLocale', () => {
  it('uses a supported cookie over Accept-Language', () => {
    expect(resolveLocale({ cookie: 'pt-BR', acceptLanguage: 'en-US,en;q=0.9' })).toBe('pt-BR')
    expect(resolveLocale({ cookie: 'en', acceptLanguage: 'pt-BR' })).toBe('en')
  })

  it('negotiates Accept-Language when there is no cookie', () => {
    expect(resolveLocale({ cookie: undefined, acceptLanguage: 'pt-BR,pt;q=0.9' })).toBe('pt-BR')
  })

  it('falls back to negotiation when the cookie is not a supported locale', () => {
    expect(resolveLocale({ cookie: 'fr', acceptLanguage: 'pt-BR' })).toBe('pt-BR')
    expect(resolveLocale({ cookie: '', acceptLanguage: 'pt-BR' })).toBe('pt-BR')
  })

  it('accepts only the exact enum values in the cookie', () => {
    expect(resolveLocale({ cookie: 'pt-br', acceptLanguage: 'en-US' })).toBe('en')
  })

  it('picks the first supported language in quality order', () => {
    expect(
      resolveLocale({ cookie: undefined, acceptLanguage: 'fr;q=0.9,pt-BR;q=0.8,en;q=0.5' })
    ).toBe('pt-BR')
    expect(resolveLocale({ cookie: undefined, acceptLanguage: 'en;q=0.5,pt-BR;q=0.9' })).toBe(
      'pt-BR'
    )
  })

  it('maps a regional tag to the locale of its language', () => {
    expect(resolveLocale({ cookie: undefined, acceptLanguage: 'pt-PT' })).toBe('pt-BR')
    expect(resolveLocale({ cookie: undefined, acceptLanguage: 'en-GB' })).toBe('en')
  })

  it('skips a language refused with quality 0', () => {
    expect(resolveLocale({ cookie: undefined, acceptLanguage: 'pt-BR;q=0,en;q=0.1' })).toBe('en')
  })

  it('defaults to English when neither input names a supported locale', () => {
    expect(resolveLocale({ cookie: 'fr', acceptLanguage: 'de-DE,fr;q=0.8' })).toBe('en')
    expect(resolveLocale({ cookie: undefined, acceptLanguage: null })).toBe('en')
    expect(resolveLocale({ cookie: undefined, acceptLanguage: undefined })).toBe('en')
    expect(resolveLocale({ cookie: undefined, acceptLanguage: '*' })).toBe('en')
  })
  it('orders the header ranges by quality and ignores refused, wildcard and malformed ones', () => {
    expect(
      resolveLocale({
        cookie: undefined,
        acceptLanguage: 'en;q=0.4, pt-BR, fr;q=0.8, de;q=0.8',
      })
    ).toBe('pt-BR')
    expect(
      resolveLocale({
        cookie: undefined,
        acceptLanguage: 'pt-BR;q=0, *, en;q=abc, pt-PT;q=0.2',
      })
    ).toBe('pt-BR')
  })
})

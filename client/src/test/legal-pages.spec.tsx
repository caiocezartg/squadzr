/**
 * The legal pages (#162): the Privacy Policy at `/privacy` and the Terms of Use at `/terms`. Both are
 * public, render on the server in either language, show when they were last updated, and carry their
 * own title and description.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { NextIntlClientProvider, createTranslator } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PrivacyPage, { generateMetadata as privacyMetadata } from '@/app/(legal)/privacy/page'
import TermsPage, { generateMetadata as termsMetadata } from '@/app/(legal)/terms/page'
import LegalLayout from '@/app/(legal)/layout'
import { LandingFooter } from '@/components/landing/landing-footer'
import type { Locale } from '@/i18n/locales'
import en from '@/locales/en.json'
import ptBR from '@/locales/pt-BR.json'
import { ClockProvider } from '@/hooks/use-clock'
import { SessionProvider } from '@/hooks/use-session'

const MESSAGES = { en, 'pt-BR': ptBR } as const

// The request's language, which `getTranslations` reads on the server.
let requestLocale: Locale = 'en'

vi.mock('next-intl/server', () => ({
  getTranslations: (namespace?: string) =>
    Promise.resolve(
      createTranslator({
        locale: requestLocale,
        messages: MESSAGES[requestLocale],
        namespace: namespace as never,
      })
    ),
}))

function renderIn(locale: Locale, element: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
      <ClockProvider>
        <SessionProvider initialSession={null}>{element}</SessionProvider>
      </ClockProvider>
    </NextIntlClientProvider>
  )
}

beforeEach(() => {
  requestLocale = 'en'
})

describe('privacy policy page', () => {
  it('renders the policy in English with its last update and contact channel', () => {
    const html = renderIn('en', <PrivacyPage />)

    expect(html).toContain('<h1')
    expect(html).toContain('Privacy Policy')
    expect(html).toContain('Last updated: November 14, 2026')
    expect(html).toContain('href="mailto:support@squadzr.app"')
    // What Discord sends, by the scopes Better Auth requests: identify and email.
    expect(html).toContain('email address')
    expect(html).toContain('IP address')
    expect(html).toContain('Railway')
    expect(html).toContain('NEXT_LOCALE')
  })

  it('renders the policy in Portuguese', () => {
    const html = renderIn('pt-BR', <PrivacyPage />)

    expect(html).toContain('Política de Privacidade')
    expect(html).toContain('Última atualização: 14 de novembro de 2026')
    expect(html).toContain('LGPD')
  })

  it('has its own title and description in the request language', async () => {
    expect(await privacyMetadata()).toMatchObject({
      title: 'Privacy Policy',
      description: expect.stringContaining('Discord') as unknown,
    })

    requestLocale = 'pt-BR'
    expect(await privacyMetadata()).toMatchObject({ title: 'Política de Privacidade' })
  })
})

describe('legal layout', () => {
  it('gives each page a way home and puts the footer with both legal links below it', () => {
    const page = renderIn('en', <PrivacyPage />)
    const layout = renderIn('en', <LegalLayout>document</LegalLayout>)

    expect(page).toContain('aria-label="Squadzr home"')
    expect(page).toContain('href="/"')
    expect(page).toContain('<main')
    expect(layout).toContain('href="/privacy"')
    expect(layout).toContain('href="/terms"')
  })
})

describe('landing footer', () => {
  it('links both legal pages and states that Squadzr is not affiliated with Discord', () => {
    const html = renderIn('en', <LandingFooter />)

    expect(html).toContain('href="/privacy"')
    expect(html).toContain('href="/terms"')
    expect(html).toContain('not affiliated with, endorsed by, or sponsored by Discord Inc.')
  })

  it('points its in-page links at the landing, so they work from the legal pages too', () => {
    const html = renderIn('en', <LandingFooter />)

    expect(html).toContain('href="/#faq"')
    expect(html).not.toContain('href="#faq"')
  })
})

describe('terms of use page', () => {
  it('renders the terms in English with its last update', () => {
    const html = renderIn('en', <TermsPage />)

    expect(html).toContain('Terms of Use')
    expect(html).toContain('Last updated: November 14, 2026')
    expect(html).toContain('Brazil')
    expect(html).toContain('href="mailto:support@squadzr.app"')
  })

  it('renders the terms in Portuguese', () => {
    const html = renderIn('pt-BR', <TermsPage />)

    expect(html).toContain('Termos de Uso')
    expect(html).toContain('Brasil')
  })

  it('has its own title and description in the request language', async () => {
    expect(await termsMetadata()).toMatchObject({
      title: 'Terms of Use',
      description: expect.any(String) as unknown,
    })

    requestLocale = 'pt-BR'
    expect(await termsMetadata()).toMatchObject({ title: 'Termos de Uso' })
  })
})

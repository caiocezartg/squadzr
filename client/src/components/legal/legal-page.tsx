import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'
import { LanguageToggle } from '@/components/layout/language-toggle'
import type { LegalDocumentKind } from './legal'
import { LegalDocument } from './legal-document'

/**
 * A legal page: a plain header with the logo (back to the landing) and the language switch, then the
 * document. The legal layout adds the footer below.
 */
export function LegalPage({ kind }: { readonly kind: LegalDocumentKind }) {
  const t = useTranslations('legal.header')

  return (
    <>
      <header className="shadow-[inset_0_-1px_0_var(--color-line)]">
        <div className="mx-auto flex max-w-310 items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <AppLink
            href="/"
            aria-label={t('home')}
            className="focus-visible:outline-mint block shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <img src="/squadzr-logo.svg" alt="" className="block w-26" />
          </AppLink>
          <LanguageToggle fluid={false} bare />
        </div>
      </header>
      <main>
        <LegalDocument kind={kind} />
      </main>
    </>
  )
}

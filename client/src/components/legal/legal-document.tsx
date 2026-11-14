import { Fragment, type ReactNode } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, type LegalDocumentKind } from './legal'

/** One section of a document, as the message files hold it: lead paragraphs, then a list, then notes. */
interface LegalSection {
  readonly title: string
  readonly paragraphs: readonly string[]
  readonly items?: readonly string[]
  readonly notes?: readonly string[]
}

const EMAIL_TOKEN = '{email}'

const LINK_CLASSES =
  'text-mint focus-visible:outline-mint underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2'

/** A message's text, with each `{email}` placeholder turned into a mail link to the contact address. */
function withContactLink(text: string): ReactNode {
  const parts = text.split(EMAIL_TOKEN)
  if (parts.length === 1) return text

  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className={LINK_CLASSES}>
          {LEGAL_CONTACT_EMAIL}
        </a>
      )}
      {part}
    </Fragment>
  ))
}

function Paragraphs({ texts }: { readonly texts: readonly string[] }) {
  return texts.map((text, index) => (
    <p key={index} className="type-body text-text-2">
      {withContactLink(text)}
    </p>
  ))
}

/**
 * A legal document (the Privacy Policy or the Terms of Use): its title, the day it last changed, the
 * introduction and the numbered sections, all from the message files, so it reads in the viewer's
 * language. It has no state, so it renders in the server HTML.
 */
export function LegalDocument({ kind }: { readonly kind: LegalDocumentKind }) {
  const t = useTranslations('legal')
  const format = useFormatter()
  const sections = t.raw(`${kind}.sections`) as readonly LegalSection[]
  const lastUpdated = format.dateTime(LEGAL_LAST_UPDATED, { dateStyle: 'long', timeZone: 'UTC' })

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-10 px-4 pt-10 pb-24 break-words sm:px-6 sm:pt-16">
      <header className="flex flex-col gap-4">
        <h1 className="type-panel-title text-text text-[40px] sm:text-[56px]">
          {t(`${kind}.title`)}
        </h1>
        <p className="font-mono text-muted text-xs">{t('lastUpdated', { date: lastUpdated })}</p>
        <p className="type-body text-text-2">{t(`${kind}.intro`)}</p>
      </header>

      {sections.map((section, index) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="type-ui text-text text-lg font-bold">
            {index + 1}. {section.title}
          </h2>
          <Paragraphs texts={section.paragraphs} />
          {section.items && section.items.length > 0 && (
            <ul className="type-body text-text-2 flex list-disc flex-col gap-1.5 pl-5">
              {section.items.map((item) => (
                <li key={item}>{withContactLink(item)}</li>
              ))}
            </ul>
          )}
          {section.notes && <Paragraphs texts={section.notes} />}
        </section>
      ))}
    </article>
  )
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { DEFAULT_PREVIEW } from '@/lib/site-metadata'
import { LEGAL_PATHS, type LegalDocumentKind } from './legal'

/**
 * A legal page's metadata in the request's language: its own title (the root template adds the app
 * name), description and canonical address. The link preview keeps the default image and takes the
 * page's own title and description.
 */
export async function legalMetadata(kind: LegalDocumentKind): Promise<Metadata> {
  const t = await getTranslations(`legal.${kind}`)
  const title = t('title')
  const description = t('description')
  const url = LEGAL_PATHS[kind]

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...DEFAULT_PREVIEW.openGraph, title, description, url },
    twitter: { ...DEFAULT_PREVIEW.twitter, title, description },
  }
}

import { describe, expect, it } from 'vitest'
import { DEFAULT_PREVIEW, ROOT_METADATA, SITE_DESCRIPTION, SITE_TITLE } from './site-metadata'

const image = {
  url: '/og-landing.png',
  width: 1200,
  height: 630,
  alt: expect.stringContaining('Squadzr'),
  type: 'image/png',
}

describe('the default metadata', () => {
  it('resolves every relative URL against the production origin', () => {
    expect(ROOT_METADATA.metadataBase.href).toBe('https://squadzr.app/')
  })

  it('gives every page the landing preview: title, description and the 1200×630 image', () => {
    expect(ROOT_METADATA.description).toBe(SITE_DESCRIPTION)
    expect(ROOT_METADATA.openGraph).toEqual({
      siteName: 'Squadzr',
      type: 'website',
      url: '/',
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [image],
    })
  })

  it('asks X for the large image card', () => {
    expect(ROOT_METADATA.twitter).toEqual({
      card: 'summary_large_image',
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [image],
    })
  })

  it('keeps the title template and the icons', () => {
    expect(ROOT_METADATA.title).toEqual({ default: 'Squadzr', template: '%s · Squadzr' })
    expect(ROOT_METADATA.icons.apple).toEqual({ url: '/apple-touch-icon.png', sizes: '180x180' })
    expect(ROOT_METADATA.manifest).toBe('/site.webmanifest')
  })

  it('shares the preview with pages that fall back to it', () => {
    expect(ROOT_METADATA).toMatchObject(DEFAULT_PREVIEW)
  })
})

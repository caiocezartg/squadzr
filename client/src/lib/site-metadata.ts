import type { Metadata } from 'next'

/** The production origin. Every relative URL in the metadata, the preview image's included, resolves against it. */
export const SITE_URL = 'https://squadzr.app'

export const SITE_NAME = 'Squadzr'

/** The landing's title, which is also every link preview's default title. */
export const SITE_TITLE = 'Squadzr — Find your gaming squad'

export const SITE_DESCRIPTION =
  'Fill your team for LoL, CS, Valorant, Dota and more. Find the players your squad is missing, sign in with Discord and get into the match tonight. Free.'

/**
 * The branded 1200×630 preview, a static file rendered once from `client/og/landing-preview.html`. Its
 * content stays in the middle 600px, so it still reads when WhatsApp crops it to a square.
 */
export const SITE_PREVIEW_IMAGE = {
  url: '/og-landing.png',
  width: 1200,
  height: 630,
  alt: 'Squadzr: Build your squad. Play tonight. Full teams for LoL, CS, Valorant, Dota and more.',
  type: 'image/png',
}

/** The Open Graph fields every page shares: a page that sets its own `openGraph` spreads these in. */
export const SITE_OPEN_GRAPH = { siteName: SITE_NAME, type: 'website' } as const

/**
 * The link preview of any page without its own: the landing's title, description and image. A page that
 * sets `openGraph` or `twitter` replaces the whole object, so it builds on these rather than merging.
 */
export const DEFAULT_PREVIEW = {
  description: SITE_DESCRIPTION,
  openGraph: {
    ...SITE_OPEN_GRAPH,
    url: '/',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_PREVIEW_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_PREVIEW_IMAGE],
  },
} satisfies Metadata

/** The root layout's metadata: the base URL, the title template, the default preview and the icons. */
export const ROOT_METADATA = {
  metadataBase: new URL(SITE_URL),
  // Each route fills in its own title, and the template adds the app name to it.
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  ...DEFAULT_PREVIEW,
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
  manifest: '/site.webmanifest',
} satisfies Metadata

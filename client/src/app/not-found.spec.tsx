/**
 * The App Router not-found page (CCC-83). It replaces the old router's not-found component: it has
 * its own title, and its content is in the server HTML instead of starting at zero opacity.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { NotFound } from '@/components/ui/not-found'
import { EnglishIntlProvider } from '@/test/intl'
import NotFoundPage, { metadata } from './not-found'

function renderNotFound(element: ReactNode): string {
  return renderToStaticMarkup(<EnglishIntlProvider session={null}>{element}</EnglishIntlProvider>)
}

describe('not-found page', () => {
  it('has its own title', () => {
    expect(metadata.title).toBe('Page not found')
  })

  it('renders the not-found content in the server HTML, visible from the first paint', () => {
    const html = renderNotFound(<NotFound />)

    expect(html).toContain('Page not found')
    expect(html).toContain('wandered off the map')
    expect(html).toContain('Back to Home')
    expect(html).toContain('Explore Squads')
    expect(html).not.toMatch(/opacity:\s*0/)
  })

  it('renders through the page component', () => {
    const html = renderNotFound(<NotFoundPage />)

    expect(html).toContain('Page not found')
    expect(html).toContain('href="/squads"')
  })
})

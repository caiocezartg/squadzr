/** The legal documents: the Privacy Policy and the Terms of Use. */
export type LegalDocumentKind = 'privacy' | 'terms'

/** Where each legal document lives; the route folders under `app/(legal)` carry the same names. */
export const LEGAL_PATHS = {
  privacy: '/privacy',
  terms: '/terms',
} as const satisfies Record<LegalDocumentKind, string>

/** Where people send privacy requests and questions about the Terms. */
export const LEGAL_CONTACT_EMAIL = 'support@squadzr.app'

/** The day both documents last changed. Update it with any change to their text. */
export const LEGAL_LAST_UPDATED = new Date('2026-11-14T00:00:00Z')

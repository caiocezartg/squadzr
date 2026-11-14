import { LegalPage } from '@/components/legal/legal-page'
import { legalMetadata } from '@/components/legal/legal-metadata'

export function generateMetadata() {
  return legalMetadata('terms')
}

/** The Terms of Use: public, in the viewer's language, with its content in the server HTML. */
export default function TermsPage() {
  return <LegalPage kind="terms" />
}

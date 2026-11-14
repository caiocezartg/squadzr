import { LegalPage } from '@/components/legal/legal-page'
import { legalMetadata } from '@/components/legal/legal-metadata'

export function generateMetadata() {
  return legalMetadata('privacy')
}

/** The Privacy Policy: public, in the viewer's language, with its content in the server HTML. */
export default function PrivacyPage() {
  return <LegalPage kind="privacy" />
}

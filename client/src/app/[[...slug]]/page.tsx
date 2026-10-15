import { ClientOnly } from './client-only'

// Every path renders the app on the client only, so this server page just hands over.
export default function Page() {
  return <ClientOnly />
}

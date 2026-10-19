/**
 * The shell's navigation in the suite (CCC-76). The catch-all registers its router's navigator while
 * it is mounted; a scene that mounts the header around its own router registers the same way.
 */

import { useEffect } from 'react'
import { legacyNavigatorFor, registerLegacyNavigator } from '@/lib/navigation'
import type { LegacyRouter } from '@/lib/navigation'

/** Registers `router` as the old app's navigator while this is mounted, as the catch-all does. */
export function RegisterLegacyNavigator({ router }: { readonly router: LegacyRouter }) {
  useEffect(() => registerLegacyNavigator(legacyNavigatorFor(router)), [router])

  return null
}

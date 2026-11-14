'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { DiscordIcon } from '@/components/ui/icons'
import { useSession } from '@/hooks/use-session'
import { signInWithDiscord } from '@/lib/auth-client'

/**
 * The nav's account action: a visitor signs in with Discord and returns to the board; a signed-in
 * viewer gets a link to it. The session is seeded by the server, so the server HTML already has the
 * right one.
 */
export function LandingNavAuth() {
  const t = useTranslations('landing.nav')
  const session = useSession()

  if (session?.user) {
    return (
      <Button href="/squads" variant="secondary">
        {t('board')}
      </Button>
    )
  }

  return (
    <Button
      variant="discord"
      icon={<DiscordIcon />}
      onClick={() => {
        void signInWithDiscord('/squads')
      }}
    >
      {t('signIn')}
    </Button>
  )
}

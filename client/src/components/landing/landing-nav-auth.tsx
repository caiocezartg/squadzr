'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { DiscordSignInNote } from '@/components/legal/discord-notices'
import { DiscordIcon } from '@/components/ui/icons'
import { useSession } from '@/hooks/use-session'
import { signInWithDiscord } from '@/lib/auth-client'

/**
 * The nav's account action: a visitor signs in with Discord and returns to the board, with the note
 * that the password is typed on discord.com; a signed-in viewer gets a link to it. The session is
 * seeded by the server, so the server HTML already has the right one.
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

  // The note sits under the button in the narrow menu and to its left in the wide nav row; between
  // 1024px and 1280px the row has no room for it, and the sign-in prompts carry it instead.
  return (
    <div className="flex flex-col gap-2 xl:flex-row-reverse xl:items-center xl:gap-3">
      <Button
        variant="discord"
        icon={<DiscordIcon />}
        onClick={() => {
          void signInWithDiscord('/squads')
        }}
      >
        {t('signIn')}
      </Button>
      <DiscordSignInNote className="lg:max-xl:hidden xl:max-w-46 xl:text-[11px]" />
    </div>
  )
}

import { useTranslations } from 'next-intl'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ds/button'
import { NoticeScreen } from '@/components/ds/notice-screen'
import { DiscordSignInNote } from '@/components/legal/discord-notices'
import { DiscordIcon } from '@/components/ui/icons'
import { signInWithDiscord } from '@/lib/auth-client'
import { SquadCodeMark } from './squad-code-mark'

interface SquadSignInProps {
  code: string
}

/** What a visitor sees instead of a Squad: the code, and sign-in with Discord, which comes back here. */
export function SquadSignIn({ code }: SquadSignInProps) {
  const t = useTranslations()

  return (
    <NoticeScreen
      mark={<SquadCodeMark code={code} />}
      title={t('lobby.signInPrompt.title')}
      description={t('lobby.signInPrompt.description')}
      footnote={<DiscordSignInNote className="justify-center" />}
      // The shell's top bar is 3.5rem below 1024px; from there up the page has no bar above it.
      className="min-h-[calc(100dvh-3.5rem)] lg:min-h-dvh"
    >
      <Button
        variant="discord"
        full
        icon={<DiscordIcon />}
        className="sm:w-auto"
        onClick={() => void signInWithDiscord(`/squads/${encodeURIComponent(code)}`)}
      >
        {t('lobby.signInPrompt.signIn')}
      </Button>
      <Button href="/squads" variant="secondary" full icon={<LayoutGrid />} className="sm:w-auto">
        {t('lobby.signInPrompt.exploreSquads')}
      </Button>
    </NoticeScreen>
  )
}

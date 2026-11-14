'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { useTranslations } from 'next-intl'
import type { SessionDto } from '@squadzr/schemas'
import { Button } from '@/components/ds/button'
import { DiscordIcon } from '@/components/ui/icons'
import { useSession } from '@/hooks/use-session'
import { signInWithDiscord } from '@/lib/auth-client'
import { whenIdle } from '@/lib/when-idle'
import { AccountButton } from './account-button'
import type { AccountPopoverProps } from './account-popover'

// The popover brings the floating-panel code, which the Lobby does not otherwise need, so it loads when
// the page is idle instead of with every route's initial JavaScript.
const loadAccountPopover = () => import('./account-popover').then((m) => m.AccountPopover)

/**
 * The viewer's place at the foot of the sidebar: the account button with its menu, or "Sign in with
 * Discord" for a visitor.
 */
export function UserMenu() {
  const session = useSession()

  return session?.user ? <AccountMenu user={session.user} /> : <SignInButton />
}

function SignInButton() {
  const t = useTranslations('ds.shell')

  return (
    <Button
      variant="discord"
      full
      icon={<DiscordIcon className="size-4" />}
      onClick={() => void signInWithDiscord('/squads')}
    >
      {t('signIn')}
    </Button>
  )
}

interface LoadedPopover {
  readonly Popover: ComponentType<AccountPopoverProps>
  /** The viewer pressed the button before the code arrived. */
  readonly open: boolean
  /** The viewer had focus on the button the popover's button replaces. */
  readonly focused: boolean
}

/**
 * The account button, which becomes the account button with its popover once the popover's code has
 * arrived. Until then the button is the same one, so the server HTML and the first paint show the
 * account; pressing it early waits for the code and opens the menu as it lands.
 */
function AccountMenu({ user }: { readonly user: SessionDto['user'] }) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [loaded, setLoaded] = useState<LoadedPopover | null>(null)

  const load = (open: boolean) => {
    void loadAccountPopover().then((Popover) => {
      const focused = document.activeElement === buttonRef.current
      setLoaded((current) => current ?? { Popover, open, focused })
    })
  }

  useEffect(() => whenIdle(() => load(false)), [])

  if (loaded) {
    return <loaded.Popover user={user} defaultOpen={loaded.open} takeFocus={loaded.focused} />
  }

  return <AccountButton ref={buttonRef} user={user} onClick={() => load(true)} />
}

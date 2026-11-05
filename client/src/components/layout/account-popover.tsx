'use client'

import { useCallback, useRef, useState } from 'react'
import { LogOut, UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { SessionDto } from '@squadzr/schemas'
import { Button } from '@/components/ds/button'
import { Popover } from '@/components/ds/popover'
import { useMediaQuery } from '@/components/ds/use-media-query'
import { usePlayerProfileLink } from '@/features/player-profile'
import { useSignOut } from '@/hooks/use-sign-out'
import { AccountButton } from './account-button'

/** The width from which the sidebar is fixed beside the page (app-shell's `lg`), not a drawer. */
const FIXED_SIDEBAR_QUERY = '(min-width: 1024px)'

export interface AccountPopoverProps {
  readonly user: SessionDto['user']
  /** Opens at once, for a viewer who pressed the button before this code arrived. */
  readonly defaultOpen: boolean
  /** Puts focus on the button as it appears, for a viewer who had focus on its earlier twin. */
  readonly takeFocus: boolean
}

/**
 * The account menu: the account button with its popover, which holds the viewer's email and the
 * sign-out action. It lives in its own module because the popover brings the floating-panel code,
 * which the shell loads when the page is idle and no page needs sooner.
 *
 * Beside the fixed sidebar the menu opens to the right, level with the button's foot, so it never
 * covers the language switch above it; in the narrow drawer there is no room beside, so it opens above.
 */
export function AccountPopover({ user, defaultOpen, takeFocus }: AccountPopoverProps) {
  const t = useTranslations()
  const signOutViewer = useSignOut()
  const profileLink = usePlayerProfileLink()
  const besideSidebar = useMediaQuery(FIXED_SIDEBAR_QUERY)
  const [open, setOpen] = useState(defaultOpen)
  // The focus is taken once, as the button appears, and never again when this renders.
  const pendingFocus = useRef(takeFocus)
  const focusOnce = useCallback((button: HTMLButtonElement | null) => {
    if (!button || !pendingFocus.current) return
    pendingFocus.current = false
    button.focus()
  }, [])

  const openOwnProfile = () => {
    setOpen(false)
    profileLink.open(user.id)
  }

  const handleSignOut = async () => {
    setOpen(false)
    await signOutViewer()
  }

  return (
    <Popover
      side={besideSidebar ? 'right' : 'top'}
      align={besideSidebar ? 'end' : 'start'}
      open={open}
      onOpenChange={setOpen}
      title={t('ds.shell.account')}
      hideTitle
      className="w-57 p-1.5"
      trigger={<AccountButton user={user} ref={focusOnce} />}
    >
      <p className="text-muted truncate px-3 pt-2 pb-3 text-xs">{user.email}</p>
      <Button
        variant="ghost"
        full
        icon={<UserRound />}
        onClick={openOwnProfile}
        onPointerEnter={() => profileLink.prefetch(user.id)}
        onFocus={() => profileLink.prefetch(user.id)}
        className="justify-start"
      >
        {t('ds.shell.myProfile')}
      </Button>
      <Button
        variant="ghost"
        full
        icon={<LogOut />}
        onClick={() => void handleSignOut()}
        className="justify-start"
      >
        {t('common.signOut')}
      </Button>
    </Popover>
  )
}

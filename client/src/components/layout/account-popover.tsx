'use client'

import { useCallback, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { SessionDto } from '@squadzr/schemas'
import { Button } from '@/components/ds/button'
import { Popover } from '@/components/ds/popover'
import { useSignOut } from '@/hooks/use-sign-out'
import { AccountButton } from './account-button'

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
 */
export function AccountPopover({ user, defaultOpen, takeFocus }: AccountPopoverProps) {
  const t = useTranslations()
  const signOutViewer = useSignOut()
  const [open, setOpen] = useState(defaultOpen)
  // The focus is taken once, as the button appears, and never again when this renders.
  const pendingFocus = useRef(takeFocus)
  const focusOnce = useCallback((button: HTMLButtonElement | null) => {
    if (!button || !pendingFocus.current) return
    pendingFocus.current = false
    button.focus()
  }, [])

  const handleSignOut = async () => {
    setOpen(false)
    await signOutViewer()
  }

  return (
    <Popover
      side="top"
      align="start"
      open={open}
      onOpenChange={setOpen}
      title={t('ds.shell.account')}
      hideTitle
      className="w-57 p-1.5"
      trigger={<AccountButton user={user} ref={focusOnce} />}
    >
      <p className="text-ds-muted truncate px-3 pt-2 pb-3 text-xs">{user.email}</p>
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

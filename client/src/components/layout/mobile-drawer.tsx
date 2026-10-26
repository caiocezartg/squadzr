'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useInstantDismiss } from '@/components/ds/use-instant-dismiss'
import { useMediaQuery } from '@/components/ds/use-media-query'
import { WIDE_QUERY } from './notifications-bell'
import { SidebarContent } from './sidebar'

/**
 * The sidebar below 1024px: a menu button that opens it as a drawer. The drawer slides in from the
 * left in 250ms and leaves in 180ms; Escape closes it at once. Focus is trapped while it is open, and
 * returns to the menu button when it closes. It also closes when the page changes and when the
 * viewport grows to the widths that have the sidebar column. Reduced motion keeps the fade and drops
 * the slide.
 */
export function MobileDrawer() {
  const t = useTranslations('ds.shell')
  const pathname = usePathname()
  const wide = useMediaQuery(WIDE_QUERY)
  const [open, setOpen] = useState(false)
  const { instant, handleOpenChange } = useInstantDismiss(
    (next: boolean, _details: Dialog.Root.ChangeEventDetails) => setOpen(next)
  )
  const instantAttribute = instant ? '' : undefined

  useEffect(() => {
    setOpen(false)
  }, [pathname, wide])

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        aria-label={t('openMenu')}
        className="press text-text-2 hover-fine:bg-raised focus-visible:outline-mint flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <Menu aria-hidden className="size-5" strokeWidth={2.2} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-instant={instantAttribute}
          className="fixed inset-0 z-40 bg-black/60 transition-opacity duration-[250ms] ease-out data-ending-style:opacity-0 data-ending-style:duration-[180ms] data-instant:data-ending-style:duration-0 data-starting-style:opacity-0"
        />
        <Dialog.Popup
          data-instant={instantAttribute}
          className="bg-menu fixed inset-y-0 left-0 z-50 w-[min(260px,calc(100vw-3rem))] overflow-y-auto shadow-[inset_-1px_0_0_#16171b,0_0_60px_rgba(0,0,0,0.6)] outline-none transition-[opacity,translate] duration-[250ms] ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 motion-safe:data-starting-style:-translate-x-full motion-safe:data-ending-style:-translate-x-full data-ending-style:duration-[180ms] data-instant:data-ending-style:duration-0"
        >
          <Dialog.Title className="sr-only">{t('menu')}</Dialog.Title>
          <Dialog.Close
            aria-label={t('closeMenu')}
            className="press bg-raised-2 text-text-3 hover-fine:text-text focus-visible:outline-text absolute top-3 right-3 z-10 flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <X aria-hidden className="size-4" strokeWidth={2.4} />
          </Dialog.Close>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

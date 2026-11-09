'use client'

import type { ReactNode, RefObject } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useInstantDismiss } from '@/components/ds/use-instant-dismiss'
import { useMounted } from '@/components/ds/use-mounted'
import { cn } from '@/lib/utils'

interface SidePanelProps {
  readonly open: boolean
  readonly onClose: () => void
  /** The panel's accessible name, shown as its heading. */
  readonly title: string
  /** The mono line over the title. */
  readonly caption?: ReactNode
  /** Artwork at the start of the header, such as a poster. */
  readonly media?: ReactNode
  /** Where focus goes once the panel closes, such as the row that opened it. */
  readonly returnFocus?: RefObject<HTMLElement | null>
  /** Marks the content as a placeholder while the real one is read. */
  readonly busy?: boolean
  readonly footer?: ReactNode
  readonly children: ReactNode
}

/**
 * A modal panel at the right edge from 640px up, 440px wide and full height, and a bottom sheet below
 * it. It slides in from its edge in 280ms and leaves in 180ms; Escape closes it at once. Focus is
 * trapped while it is open, and the scrim and Escape close it. The body scrolls between the pinned
 * header and footer. Reduced motion keeps the fade and drops the slide.
 */
export function SidePanel({
  open,
  onClose,
  title,
  caption,
  media,
  returnFocus,
  busy = false,
  footer,
  children,
}: SidePanelProps) {
  const t = useTranslations('ds')
  const { instant, handleOpenChange } = useInstantDismiss(
    (next: boolean, _details: Dialog.Root.ChangeEventDetails) => {
      if (!next) onClose()
    }
  )
  const instantAttribute = instant ? '' : undefined
  // A panel the URL opens on the first render still slides in (see `useMounted`).
  const mounted = useMounted()

  return (
    <Dialog.Root open={open && mounted} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-instant={instantAttribute}
          className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-280 ease-out data-ending-style:opacity-0 data-ending-style:duration-180 data-instant:data-ending-style:duration-0 data-starting-style:opacity-0"
        />
        <Dialog.Popup
          data-instant={instantAttribute}
          finalFocus={returnFocus}
          aria-busy={busy}
          className={cn(
            'bg-card text-text fixed z-50 flex flex-col shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_60px_rgba(0,0,0,0.6)] outline-none',
            'max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[85dvh] sm:inset-y-0 sm:right-0 sm:w-110 sm:max-w-full',
            'transition-[translate,opacity] duration-280 ease-out',
            'max-sm:motion-safe:data-starting-style:translate-y-full max-sm:motion-safe:data-ending-style:translate-y-full',
            'sm:motion-safe:data-starting-style:translate-x-full sm:motion-safe:data-ending-style:translate-x-full',
            'motion-reduce:data-starting-style:opacity-0 motion-reduce:data-ending-style:opacity-0',
            'data-ending-style:duration-180 data-instant:data-ending-style:duration-0'
          )}
        >
          <div className="flex items-center gap-3.5 py-4.5 pr-16 pl-5 shadow-[inset_0_-1px_0_var(--color-line)]">
            {media}
            <div className="flex min-w-0 flex-col gap-1">
              {caption && <p className="type-label text-muted break-words">{caption}</p>}
              <Dialog.Title className="type-panel-title-sm text-text break-words">
                {title}
              </Dialog.Title>
            </div>
          </div>
          <Dialog.Close
            aria-label={t('close')}
            className="press bg-raised-2 text-text-3 hover-fine:text-text focus-visible:outline-text absolute top-3 right-3 z-10 flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <X aria-hidden className="size-4" strokeWidth={2.4} />
          </Dialog.Close>
          <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
            {children}
          </div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[inset_0_1px_0_var(--color-line)]">
              {footer}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

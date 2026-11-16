'use client'

import { useRef, type ReactNode, type RefObject } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { BottomSheet } from '@/components/ds/bottom-sheet'
import { NARROW_QUERY, useMediaQuery } from '@/components/ds/use-media-query'
import { useInstantDismiss } from '@/components/ds/use-instant-dismiss'
import { useMounted } from '@/components/ds/use-mounted'
import { cn } from '@/lib/utils'

interface ChatWindowProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** Where focus returns when the window closes. */
  readonly launcherRef: RefObject<HTMLButtonElement | null>
  /** Shown beside the title, such as how many members the Squad has. */
  readonly meta: ReactNode
  /** Renders the window's body, given the field that takes focus on open. */
  readonly children: (textareaRef: RefObject<HTMLTextAreaElement | null>) => ReactNode
}

/**
 * The chat window: a non-modal panel above the launcher from 640px, and the design system's bottom
 * sheet below it. The open state lives in the parent, so crossing 640px swaps the surface without
 * closing it.
 */
export function ChatWindow({ open, onOpenChange, launcherRef, meta, children }: ChatWindowProps) {
  const t = useTranslations('chat')
  const narrow = useMediaQuery(NARROW_QUERY)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  if (narrow) {
    return (
      <BottomSheet
        title={t('title')}
        open={open}
        onOpenChange={onOpenChange}
        className="bg-panel h-[85dvh] gap-0 overflow-hidden px-0 pt-5 pb-[env(safe-area-inset-bottom)] [&>h2]:mb-1.5 [&>h2]:pl-5"
      >
        <div className="text-muted px-5 pb-3">{meta}</div>
        <div className="border-line flex min-h-0 flex-1 flex-col border-t">
          {children(textareaRef)}
        </div>
      </BottomSheet>
    )
  }

  return (
    <DesktopPanel
      open={open}
      onOpenChange={onOpenChange}
      launcherRef={launcherRef}
      textareaRef={textareaRef}
      meta={meta}
    >
      {children(textareaRef)}
    </DesktopPanel>
  )
}

interface DesktopPanelProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly launcherRef: RefObject<HTMLButtonElement | null>
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>
  readonly meta: ReactNode
  readonly children: ReactNode
}

/**
 * The panel of 640px and up. It is a dialog without a focus trap or a backdrop: the page stays usable
 * and a press outside leaves it open; Escape and the close button close it. It grows from the
 * launcher's corner like the DS popover, 200ms in and 150ms out, with a fade only under reduced motion.
 */
function DesktopPanel({
  open,
  onOpenChange,
  launcherRef,
  textareaRef,
  meta,
  children,
}: DesktopPanelProps) {
  const t = useTranslations('chat')
  // A panel that mounts already open (crossing 640px while open) still plays its enter.
  const mounted = useMounted()
  // Escape closes at once, with no exit transition (docs/design/reference.md, Motion, Rules).
  const { instant, handleOpenChange } = useInstantDismiss(onOpenChange)

  return (
    <Dialog.Root
      open={open && mounted}
      onOpenChange={handleOpenChange}
      modal={false}
      disablePointerDismissal
    >
      <Dialog.Portal>
        <Dialog.Popup
          initialFocus={textareaRef}
          finalFocus={launcherRef}
          data-instant={instant ? '' : undefined}
          className={cn(
            'bg-panel text-text fixed right-5 bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+3.75rem)] z-40 flex h-[min(500px,calc(100dvh-7rem))] w-92.5 flex-col outline-none',
            'shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_60px_-20px_rgba(0,0,0,0.9)]',
            'origin-bottom-right transition-[opacity,scale] duration-200 ease-out',
            'data-starting-style:opacity-0 data-ending-style:opacity-0',
            'motion-safe:data-starting-style:scale-[0.96] motion-safe:data-ending-style:scale-[0.96]',
            'data-ending-style:duration-150 data-instant:data-ending-style:duration-0'
          )}
        >
          <header className="border-line flex items-center gap-3 border-b py-2.5 pr-2.5 pl-4">
            <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
              <Dialog.Title className="font-display truncate text-[24px] leading-none font-black uppercase">
                {t('title')}
              </Dialog.Title>
              <span className="text-muted shrink-0">{meta}</span>
            </div>
            <Dialog.Close
              aria-label={t('close')}
              className="press bg-raised-2 text-text-3 hover-fine:text-text focus-visible:outline-text flex size-9 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2"
            >
              <X aria-hidden="true" className="size-4" strokeWidth={2.4} />
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

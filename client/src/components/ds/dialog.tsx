'use client'

import type { ReactElement, ReactNode } from 'react'
import { Dialog as BaseDialog } from '@base-ui-components/react/dialog'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useInstantDismiss } from './use-instant-dismiss'

type OpenChangeDetails = BaseDialog.Root.ChangeEventDetails

interface DialogProps {
  /** The dialog's accessible name, shown as its heading unless `hideTitle` is set. */
  title: string
  hideTitle?: boolean
  /** The element that opens the dialog; leave it out when the parent drives `open`. */
  trigger?: ReactElement<Record<string, unknown>>
  open?: boolean
  defaultOpen?: boolean
  /** Base UI's change details let the parent `cancel()` a close, e.g. an Escape another widget owns. */
  onOpenChange?: (open: boolean, details: OpenChangeDetails) => void
  /** Fills the screen below 640px, with the content free to pin its own footer. */
  fullScreen?: boolean
  children: ReactNode
  /** Classes for the panel itself, e.g. a width. */
  className?: string
}

/**
 * A centred modal, 680px at most. It enters from a slight rise and scale in 280ms and leaves in
 * 180ms; Escape skips the transition. Focus is trapped while it is open, then returns to the trigger.
 * The panel is flush: the heading carries its own padding and the content sets its own. Reduced
 * motion keeps the fade and drops the movement.
 */
export function Dialog({
  title,
  hideTitle,
  trigger,
  open,
  defaultOpen,
  onOpenChange,
  fullScreen = false,
  children,
  className,
}: DialogProps) {
  const t = useTranslations('ds')
  const { instant, handleOpenChange } = useInstantDismiss(onOpenChange)
  const instantAttribute = instant ? '' : undefined

  return (
    <BaseDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={handleOpenChange}>
      {trigger && <BaseDialog.Trigger render={trigger} />}
      <BaseDialog.Portal>
        <BaseDialog.Backdrop
          data-instant={instantAttribute}
          className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-280 ease-out data-ending-style:opacity-0 data-ending-style:duration-180 data-instant:data-ending-style:duration-0 data-starting-style:opacity-0"
        />
        <BaseDialog.Popup
          data-instant={instantAttribute}
          className={cn(
            'bg-card text-text fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-170 flex-col overflow-y-auto scrollbar-thin shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_50px_120px_-30px_rgba(0,0,0,0.95)] outline-none',
            'transition-[opacity,translate,scale] duration-280 ease-out',
            'data-starting-style:opacity-0 data-ending-style:opacity-0',
            'motion-safe:data-starting-style:translate-y-4 motion-safe:data-starting-style:scale-[0.985]',
            'motion-safe:data-ending-style:translate-y-4 motion-safe:data-ending-style:scale-[0.985]',
            'data-ending-style:duration-180 data-instant:data-ending-style:duration-0',
            fullScreen &&
              'max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none',
            className
          )}
        >
          <BaseDialog.Close
            aria-label={t('close')}
            className="press bg-raised-2 text-text-3 hover-fine:text-text focus-visible:outline-text absolute top-3 right-3 z-10 flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <X aria-hidden className="size-4" strokeWidth={2.4} />
          </BaseDialog.Close>
          <BaseDialog.Title
            className={cn('type-panel-title text-text px-6 pt-6 pr-16', hideTitle && 'sr-only')}
          >
            {title}
          </BaseDialog.Title>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}

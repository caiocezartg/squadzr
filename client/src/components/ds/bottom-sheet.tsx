'use client'

import { Dialog } from '@base-ui-components/react/dialog'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { FloatingPanelProps } from './floating-types'
import { useInstantDismiss } from './use-instant-dismiss'

/**
 * A panel that rises from the bottom edge. It takes the same props as a popover, so a popover can
 * stand in for it on narrow screens. It is modal: focus stays inside, Escape and the backdrop close
 * it, and focus returns to the trigger. Reduced motion swaps the slide for a fade.
 */
export function BottomSheet({
  trigger,
  title,
  hideTitle,
  children,
  open,
  defaultOpen,
  onOpenChange,
  className,
}: FloatingPanelProps) {
  const t = useTranslations('ds')
  const { instant, handleOpenChange } = useInstantDismiss(onOpenChange)
  const instantAttribute = instant ? '' : undefined

  return (
    <Dialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={handleOpenChange}>
      <Dialog.Trigger render={trigger} />
      <Dialog.Portal>
        <Dialog.Backdrop
          data-instant={instantAttribute}
          className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-[280ms] ease-out data-ending-style:opacity-0 data-ending-style:duration-[180ms] data-instant:data-ending-style:duration-0 data-starting-style:opacity-0"
        />
        <Dialog.Popup
          data-instant={instantAttribute}
          className={cn(
            'bg-raised text-text fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_-24px_60px_-20px_rgba(0,0,0,0.9)] outline-none',
            'transition-[translate,opacity] duration-[280ms] ease-out',
            'motion-safe:data-starting-style:translate-y-full motion-safe:data-ending-style:translate-y-full',
            'motion-reduce:data-starting-style:opacity-0 motion-reduce:data-ending-style:opacity-0',
            'data-ending-style:duration-[180ms] data-instant:data-ending-style:duration-0',
            className
          )}
        >
          <Dialog.Close
            aria-label={t('close')}
            className="press bg-raised-2 text-text-3 hover-fine:text-text focus-visible:outline-text absolute top-3 right-3 flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <X aria-hidden className="size-4" strokeWidth={2.4} />
          </Dialog.Close>
          <Dialog.Title
            className={cn('type-panel-title-sm text-text mb-4 pr-12', hideTitle && 'sr-only')}
          >
            {title}
          </Dialog.Title>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

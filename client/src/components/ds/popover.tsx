'use client'

import { Popover as BasePopover } from '@base-ui-components/react/popover'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { BottomSheet } from './bottom-sheet'
import type { FloatingPanelProps } from './floating-types'
import { NARROW_QUERY, useMediaQuery } from './use-media-query'

interface PopoverProps extends FloatingPanelProps {
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** Gap between the trigger and the panel, in px. */
  sideOffset?: number
  /** Renders a bottom sheet instead below 640px, with the same props. */
  bottomSheet?: boolean
}

/**
 * A panel anchored to its trigger. It grows from the trigger's own corner (`--transform-origin`) in
 * 200ms and leaves in 150ms; Escape skips the exit transition and returns focus to the trigger. Reduced motion keeps the fade and drops the scale.
 */
export function Popover({
  side = 'bottom',
  align = 'start',
  sideOffset = 8,
  bottomSheet = false,
  trigger,
  title,
  hideTitle,
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
}: PopoverProps) {
  const narrow = useMediaQuery(NARROW_QUERY)
  // The open state lives here, not in the surface, so crossing 640px swaps the surface without closing it.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = controlledOpen ?? uncontrolledOpen

  const handleOpenChange = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  if (bottomSheet && narrow) {
    return (
      <BottomSheet
        trigger={trigger}
        title={title}
        hideTitle={hideTitle}
        open={open}
        onOpenChange={handleOpenChange}
        className={className}
      >
        {children}
      </BottomSheet>
    )
  }

  return (
    <BasePopover.Root open={open} onOpenChange={handleOpenChange}>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50">
          <BasePopover.Popup
            className={cn(
              'bg-raised text-text origin-(--transform-origin) p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_60px_-20px_rgba(0,0,0,0.9)] outline-none',
              'transition-[opacity,scale] duration-200 ease-out',
              'data-starting-style:opacity-0 data-ending-style:opacity-0',
              'motion-safe:data-starting-style:scale-[0.96] motion-safe:data-ending-style:scale-[0.96]',
              'data-ending-style:duration-150 data-instant:data-ending-style:duration-0',
              className
            )}
          >
            <BasePopover.Title
              className={cn('type-panel-title-sm text-text mb-4', hideTitle && 'sr-only')}
            >
              {title}
            </BasePopover.Title>
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  )
}

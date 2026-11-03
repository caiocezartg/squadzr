import type { ReactElement, ReactNode } from 'react'

/** What a popover and its bottom sheet share, so one can stand in for the other. */
export interface FloatingPanelProps {
  /** The element that opens the panel; it receives the trigger behaviour and ARIA state. */
  trigger: ReactElement<Record<string, unknown>>
  /** The panel's accessible name, shown as its heading unless `hideTitle` is set. */
  title: string
  hideTitle?: boolean
  children: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Classes for the panel itself. */
  className?: string
}

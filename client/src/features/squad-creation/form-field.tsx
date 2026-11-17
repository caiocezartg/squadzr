import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** The ground and ring of the wizard's text controls: `#0c0d10` over a `line` ring, mint on focus. */
export const CONTROL_CLASSES =
  'bg-[#0c0d10] shadow-[inset_0_0_0_1px_var(--color-line)] focus-within:shadow-[inset_0_0_0_1.5px_var(--color-mint)]'

/** The same control with a validation error: the ring turns danger and stays so on focus. */
export const CONTROL_ERROR_CLASSES = 'bg-[#0c0d10] shadow-[inset_0_0_0_1.5px_var(--color-danger)]'

export interface FormFieldProps {
  /** The control the label names; omit it when `labelId` names a group of controls. */
  htmlFor?: string
  /** The id of the label, for a group of controls that `aria-labelledby` points at. */
  labelId?: string
  label: ReactNode
  /** Sits right after the label, such as a small help button. */
  labelAction?: ReactNode
  /** Sits at the end of the label row, such as the name's character counter. */
  aside?: ReactNode
  /** The id the error carries, so the control can name it in `aria-describedby`. */
  errorId?: string
  /** The validation message under the control. */
  error?: string
  /**
   * Follows the error on its line, such as a retry or a help link. It sits outside the element
   * `errorId` names, so the control's description stays the message alone.
   */
  errorAction?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * One labelled row of the create-Squad form: the label with an optional aside, the control and the
 * validation error. The error sits in a polite live region that exists before it has a message, so
 * a screen reader announces it when it appears.
 */
export function FormField({
  htmlFor,
  labelId,
  label,
  labelAction,
  aside,
  errorId,
  error,
  errorAction,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex items-center gap-1.5">
          {htmlFor ? (
            <label id={labelId} htmlFor={htmlFor} className="text-sm font-bold">
              {label}
            </label>
          ) : (
            <span id={labelId} className="text-sm font-bold">
              {label}
            </span>
          )}
          {labelAction}
        </span>
        {aside}
      </div>
      <div>
        {children}
        <div aria-live="polite">
          {error && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <p id={errorId} className="text-danger text-[12.5px] leading-normal">
                {error}
              </p>
              {errorAction}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

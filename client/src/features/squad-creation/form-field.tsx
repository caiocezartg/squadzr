import type { ReactNode } from 'react'

export interface FormFieldProps {
  /** The id of the control the label names; omit it for a group of controls. */
  htmlFor?: string
  label: ReactNode
  /** Muted guidance under the control, before any error. */
  hint?: ReactNode
  /** The validation message the field shows in place of its hint. */
  error?: string
  /** Layout classes for the field's row, such as a grid span. */
  className?: string
  children: ReactNode
}

/**
 * One labelled row of the create-Squad form. The label, the control, the hint and the validation
 * error keep the same spacing and styles on every field, so the form reads as one shape.
 */
export function FormField({ htmlFor, label, hint, error, className, children }: FormFieldProps) {
  const labelClassName = 'block whitespace-nowrap text-sm font-medium text-offwhite'

  return (
    <div className={className ? `space-y-1.5 ${className}` : 'space-y-1.5'}>
      <label htmlFor={htmlFor} className={labelClassName}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

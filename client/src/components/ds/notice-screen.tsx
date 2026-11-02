import type { ReactNode } from 'react'

interface NoticeScreenProps {
  /** A Lucide icon, drawn in the square above the title. It is decorative. */
  icon: ReactNode
  title: string
  description: string
  /** What sits under the description: a code chip, the actions. */
  children?: ReactNode
}

/**
 * A full-height notice that stands in for a page with nothing to show, such as a not-found. It has no
 * artboard, so it follows the board's empty state: the icon square, the panel title and the body copy.
 */
export function NoticeScreen({ icon, title, description, children }: NoticeScreenProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-24">
      <div className="flex w-full max-w-md flex-col items-center gap-3 text-center">
        <span
          aria-hidden="true"
          className="bg-line text-muted flex size-13 items-center justify-center [&_svg]:size-5.5"
        >
          {icon}
        </span>
        <h1 className="type-panel-title-sm text-text">{title}</h1>
        <p className="type-body text-text-3">{description}</p>
        {children}
      </div>
    </div>
  )
}

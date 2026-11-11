'use client'

import type { AnchorHTMLAttributes, ComponentProps, MouseEvent } from 'react'
import Link from 'next/link'
import { useAppNavigation } from '@/lib/navigation'

type AppLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { readonly href: string }

/**
 * A link in the shell. A plain left click navigates through the shell's navigation helper, so a
 * route of the old app is reached without a reload; a modified click or a `target` keeps the
 * browser's own anchor behaviour.
 */
export function AppLink({ href, onClick, ...anchor }: AppLinkProps) {
  const navigate = useAppNavigation()

  return (
    <Link
      {...anchor}
      href={href}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || !isPlainLeftClick(event, anchor)) return

        event.preventDefault()
        navigate(href)
      }}
    />
  )
}

function isPlainLeftClick(
  event: MouseEvent<HTMLAnchorElement>,
  anchor: Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'target' | 'download'>
): boolean {
  const modified = event.metaKey || event.altKey || event.ctrlKey || event.shiftKey
  const sameWindow = anchor.target === undefined || anchor.target === '_self'
  return event.button === 0 && !modified && sameWindow && anchor.download === undefined
}

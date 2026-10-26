import type { ButtonHTMLAttributes, Ref } from 'react'
import { ChevronDown } from 'lucide-react'
import type { SessionDto } from '@squadzr/schemas'
import { Avatar } from '@/components/ds/avatar'

interface AccountButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly user: SessionDto['user']
  readonly ref?: Ref<HTMLButtonElement>
}

/**
 * The account button at the foot of the sidebar: the avatar with its presence dot, the name and a
 * chevron. The menu that opens from it attaches its own trigger behaviour through the props, and the
 * server render and the first paint show this same button before that menu's code has arrived.
 */
export function AccountButton({ user, ref, ...button }: AccountButtonProps) {
  return (
    <button
      type="button"
      {...button}
      ref={ref}
      className="press bg-card text-text hover-fine:bg-raised focus-visible:outline-mint flex w-full items-center gap-2.5 py-2 pr-3 pl-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2"
    >
      <span className="relative shrink-0">
        <Avatar
          size={34}
          playerId={user.id}
          name={user.name}
          image={user.image}
          surface="#121317"
        />
        <span
          aria-hidden="true"
          className="bg-mint absolute -right-px -bottom-px size-2.5 rounded-full shadow-[0_0_0_2px_#121317]"
        />
      </span>
      <span className="type-ui min-w-0 flex-1 truncate text-[13px]">{user.name}</span>
      <ChevronDown aria-hidden className="text-ds-muted size-3.5 shrink-0" strokeWidth={2.4} />
    </button>
  )
}

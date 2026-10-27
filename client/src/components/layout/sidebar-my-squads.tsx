'use client'

import { useId } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { SidebarSquadItem } from '@/components/ds/sidebar-squad-item'
import { DiscordIcon } from '@/components/ui/icons'
import { useMySquads } from '@/features/my-squads'
import { useSession } from '@/hooks/use-session'
import { signInWithDiscord } from '@/lib/auth-client'
import { lobbyHref } from '@/lib/squad-links'

interface SidebarMySquadsProps {
  /** Called when the viewer picks a squad, so a drawer can close. */
  readonly onNavigate?: () => void
}

/**
 * The viewer's squads, between "All squads" and the account controls (reference, Components, Sidebar):
 * the Squads they host or joined, newest first. A visitor sees a call to sign in instead. The section
 * takes the room left in the column, and only its list scrolls, so the controls stay at the foot.
 */
export function SidebarMySquads({ onNavigate }: SidebarMySquadsProps) {
  const t = useTranslations('ds.shell')
  const headingId = useId()
  const session = useSession()
  const userId = session?.user?.id

  return (
    <section aria-labelledby={headingId} className="flex min-h-0 flex-1 flex-col gap-2.5">
      {userId ? (
        <MySquadsList headingId={headingId} userId={userId} onNavigate={onNavigate} />
      ) : (
        <>
          <h2 id={headingId} className="type-label text-ds-muted px-2">
            {t('mySquads')}
          </h2>
          <div className="flex flex-col items-start gap-3 px-2">
            <p className="text-text-3 text-[13px] leading-snug font-medium">
              {t('mySquadsSignIn')}
            </p>
            <Button
              variant="discord"
              size="sm"
              icon={<DiscordIcon className="size-4" />}
              onClick={() => void signInWithDiscord('/squads')}
            >
              {t('mySquadsSignInAction')}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

function MySquadsList({
  headingId,
  userId,
  onNavigate,
}: {
  readonly headingId: string
  readonly userId: string
  readonly onNavigate?: () => void
}) {
  const t = useTranslations('ds.shell')
  const pathname = usePathname()
  const squads = useMySquads()

  return (
    <>
      <div className="flex items-center justify-between px-2">
        <h2 id={headingId} className="type-label text-ds-muted">
          {t('mySquads')}
        </h2>
        <span className="font-ds-mono text-ds-muted text-[11px] font-bold">{squads.length}</span>
      </div>
      <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
        {squads.map((squad) => {
          const href = lobbyHref(squad.code)
          const filled = squad.memberCount ?? 1

          return (
            <SidebarSquadItem
              key={squad.id}
              href={href}
              name={squad.name}
              coverUrl={squad.game.coverUrl}
              filled={filled}
              total={squad.maxPlayers}
              host={squad.hostId === userId}
              ready={squad.memberCount === squad.maxPlayers}
              current={pathname.toLowerCase() === href.toLowerCase()}
              onNavigate={onNavigate}
            />
          )
        })}
      </div>
    </>
  )
}

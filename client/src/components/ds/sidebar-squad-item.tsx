import { useTranslations } from 'next-intl'
import { DiscordIcon } from '@/components/ui/icons'
import { AppLink } from '@/components/layout/app-link'
import { cn } from '@/lib/utils'
import { SlotMeter } from './slot-meter'

interface SidebarSquadItemProps {
  readonly href: string
  readonly name: string
  /** The game's cover, which stands for the Squad. */
  readonly coverUrl: string
  readonly filled: number
  readonly total: number
  /** The viewer hosts the Squad: the crown shows. */
  readonly host?: boolean
  /** The Squad is Ready (full): the Discord badge, tone and count show. */
  readonly ready?: boolean
  /** The Lobby being viewed. */
  readonly current?: boolean
  readonly onNavigate?: () => void
}

/**
 * One Squad of the sidebar's "My squads" (reference, Components, Sidebar): cover, host crown, name,
 * line slot meter and count. The count is amber when one slot is left; a Ready Squad takes the Discord
 * badge, tone and count. The current item has no transition: it takes its ground and edge the moment
 * the page does.
 */
export function SidebarSquadItem({
  href,
  name,
  coverUrl,
  filled,
  total,
  host = false,
  ready = false,
  current = false,
  onNavigate,
}: SidebarSquadItemProps) {
  const t = useTranslations('ds.sidebarSquad')
  const lastSlot = !ready && total - filled === 1

  return (
    <AppLink
      href={href}
      onClick={onNavigate}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'focus-visible:outline-mint relative flex min-h-14 gap-2.75 py-2 pr-2.5 pl-2 focus-visible:outline-2 focus-visible:-outline-offset-2',
        current
          ? 'bg-raised shadow-[inset_2px_0_0_var(--color-mint)]'
          : 'bg-card hover-fine:bg-raised'
      )}
    >
      <span className="bg-raised-2 block h-14 w-10.5 shrink-0">
        <img src={coverUrl} alt="" loading="lazy" className="block size-full object-cover" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.25">
        <span className={cn('flex min-w-0 items-center gap-1.5', ready && 'pr-5.5')}>
          {host && <HostCrown label={t('host')} />}
          <span className="type-ui text-text min-w-0 truncate text-[13px]">{name}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="block min-w-0 flex-1">
            <SlotMeter
              variant="line"
              filled={filled}
              total={total}
              tone={ready ? 'discord' : 'mint'}
            />
          </span>
          <span
            className={cn(
              'font-ds-mono shrink-0 text-[10.5px] font-bold',
              ready ? 'text-discord-soft' : lastSlot ? 'text-amber' : 'text-text-3'
            )}
          >
            {filled}/{total}
          </span>
        </span>
      </span>

      {ready && (
        <span
          role="img"
          aria-label={t('inviteUnlocked')}
          className="bg-ds-discord absolute top-2 right-2 flex size-4.5 items-center justify-center text-white"
        >
          <DiscordIcon aria-hidden="true" className="size-2.75" />
        </span>
      )}
    </AppLink>
  )
}

function HostCrown({ label }: { readonly label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="bg-amber flex size-3.75 shrink-0 items-center justify-center rounded-full text-[#2a1a00]"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-2.25">
        <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z" />
      </svg>
    </span>
  )
}

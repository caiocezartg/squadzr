import { useTranslations } from 'next-intl'

/** Up to two initials of a server's name, for a server with no icon. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase()
}

export interface DiscordServerRowProps {
  name: string
  iconUrl: string | null
  memberCount: number | null
}

/**
 * The Discord server behind the typed invite, as a compact row under the field: its icon (initials
 * when it has none), its name and how many members it has. It follows the Lobby's server card.
 */
export function DiscordServerRow({ name, iconUrl, memberCount }: DiscordServerRowProps) {
  const t = useTranslations('ds.createSquad')

  return (
    <div className="flex items-center gap-3 bg-[#0c0d10] p-2">
      {iconUrl ? (
        <img src={iconUrl} alt="" className="block size-10 shrink-0 rounded-xl object-cover" />
      ) : (
        <span
          aria-hidden
          className="bg-ds-discord font-display flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white"
        >
          {initials(name)}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm/5 font-extrabold">{name}</span>
        {memberCount !== null && (
          <span className="font-ds-mono text-ds-muted text-[11px] tabular-nums">
            {t('discordServerMembers', { count: memberCount })}
          </span>
        )}
      </div>
    </div>
  )
}

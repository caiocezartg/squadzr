import { useTranslations } from 'next-intl'

export interface DiscordCallRowProps {
  /** The voice or stage channel the invite points to. */
  name: string
}

/**
 * The Voice Call behind the typed invite, as the foot of the server row: a speaker under the server's
 * icon and the call's name under the server's name. Channel names run long and mix in emoji, so the
 * name truncates instead of widening the dialog.
 */
export function DiscordCallRow({ name }: DiscordCallRowProps) {
  const t = useTranslations('ds.createSquad')

  return (
    <p className="flex min-w-0 items-center gap-3 bg-[#0c0d10] px-2 py-1.5 shadow-[inset_0_1px_0_var(--color-line)]">
      <span aria-hidden className="flex w-10 shrink-0 justify-center text-sm/5">
        🔊
      </span>
      <span className="sr-only">{t('discordCallLabel')}: </span>
      <span className="font-mono text-text-2 min-w-0 truncate text-[11px]/5 font-bold">{name}</span>
    </p>
  )
}

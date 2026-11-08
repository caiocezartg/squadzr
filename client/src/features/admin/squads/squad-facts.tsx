'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminSquadDetailDto } from '@squadzr/schemas'
import { NoValue } from '../shared/no-value'
import { RelativeTime } from './squad-parts'

/** The Squad's facts in two columns: slots, language, created, last activity and the Discord invite. */
export function SquadFacts({ squad }: { readonly squad: AdminSquadDetailDto }) {
  const t = useTranslations('admin.squads.panel')

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
      <Fact label={t('slots')}>
        <span className="type-code text-text">
          {squad.memberCount} / {squad.maxPlayers}
        </span>
      </Fact>
      <Fact label={t('language')}>{t(`languages.${languageKey(squad.language)}`)}</Fact>
      <Fact label={t('created')}>
        <RelativeTime at={squad.createdAt} />
      </Fact>
      <Fact label={t('lastActivity')}>
        <RelativeTime at={squad.lastActivityAt} />
      </Fact>
      <Fact label={t('discord')} wide>
        <DiscordInvite link={squad.discordLink} />
      </Fact>
    </dl>
  )
}

function languageKey(language: AdminSquadDetailDto['language']): 'en' | 'ptBr' {
  return language === 'pt-br' ? 'ptBr' : 'en'
}

function Fact({
  label,
  wide = false,
  children,
}: {
  readonly label: string
  readonly wide?: boolean
  readonly children: ReactNode
}) {
  return (
    <div className={wide ? 'col-span-2 flex flex-col gap-1' : 'flex flex-col gap-1'}>
      <dt className="type-label text-muted">{label}</dt>
      <dd className="text-text text-sm font-semibold break-words">{children}</dd>
    </div>
  )
}

/**
 * The Discord invite in full, so an admin can judge it: a link that opens in a new tab when it is an
 * https address, the bare text otherwise, and a dash when the Squad has none.
 */
function DiscordInvite({ link }: { readonly link: string | null }) {
  if (link === null) return <NoValue />
  if (!isHttps(link)) return <span className="font-mono text-[13px] break-all">{link}</span>

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="text-mint focus-visible:outline-mint font-mono text-[13px] break-all underline decoration-1 underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {link}
    </a>
  )
}

function isHttps(link: string): boolean {
  try {
    return new URL(link).protocol === 'https:'
  } catch {
    return false
  }
}

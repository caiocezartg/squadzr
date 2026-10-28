'use client'

import { Check, Copy, ExternalLink, Link as LinkIcon, Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { CopySwap } from '@/components/ds/copy-swap'
import { DiscordIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import type { DiscordInviteLink } from '../discord-invite-link'
import { useCopiedFlag } from '../use-copied-flag'

/** How long the link row's copy button says "Copied" (reference, DiscordInvite). */
const COPIED_MS = 1_800

/** What the invite's mask shows in place of the link, while the Squad forms. */
const MASKED_LINK = 'discord.gg/••••••••'

/**
 * The invite bar while the Squad forms (reference, DiscordInvite): a lock, what it waits for and a masked
 * link. The mask is not the invite, so it never carries a character of it.
 */
export function LockedInvite() {
  const t = useTranslations('ds.invite')

  return (
    <section className="bg-panel flex flex-wrap items-center gap-4 px-4.5 py-4.5 sm:px-5.5">
      <span className="bg-raised text-discord-soft flex size-11.5 shrink-0 items-center justify-center">
        <Lock aria-hidden="true" className="size-5 stroke-[2.4]" />
      </span>
      <div className="flex min-w-0 flex-[1_1_17.5rem] flex-col gap-1">
        <h2 className="text-[15px] font-extrabold">{t('lockedTitle')}</h2>
        <p className="text-text-3 text-[13px] leading-normal">{t('lockedBody')}</p>
      </div>
      <span
        aria-hidden="true"
        className="font-ds-mono text-[13px] tracking-[0.04em] text-[#4a4c54]"
      >
        {MASKED_LINK}
      </span>
    </section>
  )
}

interface ReadyInviteProps {
  readonly invite: DiscordInviteLink
  /** The Squad's name, which the server card carries. */
  readonly squadName: string
  /** The game's cover, which stands in as the server's icon. */
  readonly coverUrl: string | null
  /** Members in the room now, from Presence. */
  readonly online: number
  readonly members: number
  /** The viewer watched the Squad complete: the panel enters, and the sheen sweeps once. */
  readonly entering: boolean
}

/**
 * The invite once the last slot closes (reference, DiscordInvite): the "Bora pro Discord" panel, built
 * from the snapshot alone. The sheen sweeps once on entry and never loops.
 */
export function ReadyInvite({
  invite,
  squadName,
  coverUrl,
  online,
  members,
  entering,
}: ReadyInviteProps) {
  const t = useTranslations('ds.invite')
  const [copied, markCopied] = useCopiedFlag(COPIED_MS)

  const copyInvite = async () => {
    await navigator.clipboard.writeText(invite.href)
    markCopied()
  }
  const copyLabel = copied ? t('copied') : t('copyLink')

  return (
    <section
      aria-labelledby="lobby-invite-heading"
      className={cn(
        'bg-ds-discord relative overflow-hidden text-white',
        entering && 'motion-safe:animate-invite-enter motion-reduce:animate-invite-fade'
      )}
    >
      {entering && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 hidden w-[24%] bg-linear-to-r from-white/0 via-white/14 to-white/0 motion-safe:block motion-safe:animate-invite-sheen"
        />
      )}
      <DiscordIcon
        aria-hidden="true"
        className="absolute -right-7.5 -bottom-14 size-67.5 text-white opacity-16"
      />

      <div className="relative flex flex-col gap-5.5 p-4.5 sm:p-7 lg:pr-48">
        <div className="flex flex-col gap-3">
          <span className="font-ds-mono inline-flex items-center gap-2 self-start bg-bg/25 px-2.5 py-1.5 text-[11.5px] font-bold tracking-[0.14em]">
            <Check aria-hidden="true" className="size-3 stroke-3" />
            {t('badge')}
          </span>
          <h2
            id="lobby-invite-heading"
            className="font-display text-[44px] leading-none font-black wrap-anywhere uppercase sm:text-[72px]"
          >
            {t('title')}
          </h2>
        </div>

        <div className="bg-bg/30 flex flex-col shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
          <div className="flex flex-wrap items-center gap-x-4.5 gap-y-4 p-4.5">
            <ServerIcon coverUrl={coverUrl} />
            <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-1.5">
              <span className="font-ds-mono text-[11px] font-bold tracking-[0.14em] text-white/75">
                {t('serverInvite')}
              </span>
              <span className="truncate text-xl leading-tight font-extrabold">{squadName}</span>
              <span className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] font-semibold text-white/85">
                <span className="inline-flex items-center gap-1.75">
                  <span aria-hidden="true" className="bg-mint size-2 rounded-full" />
                  {t('inRoomNow', { count: online })}
                </span>
                <span className="inline-flex items-center gap-1.75">
                  <span aria-hidden="true" className="size-2 rounded-full bg-white/55" />
                  {t('players', { count: members })}
                </span>
              </span>
            </div>
            <Button
              variant="light"
              size="lg"
              href={invite.href}
              target="_blank"
              rel="noopener noreferrer"
              icon={<ExternalLink />}
              iconPosition="end"
              className="max-sm:w-full"
            >
              {t('open')}
            </Button>
          </div>

          <div className="flex items-center gap-3 bg-bg/26 py-2 pr-2 pl-4.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <LinkIcon aria-hidden="true" className="size-4 shrink-0 stroke-[2.4] text-white/70" />
            <span className="font-ds-mono min-w-0 flex-1 truncate text-[15px] font-bold">
              <span className="text-white/60">{invite.host}</span>
              {invite.code}
            </span>
            <Button variant="glass" aria-label={copyLabel} onClick={() => void copyInvite()}>
              <CopySwap
                copied={copied}
                idle={
                  <>
                    {t('copyLink')}
                    <Copy className="size-3.75" />
                  </>
                }
                done={
                  <>
                    {t('copied')}
                    <Check className="size-3.75" />
                  </>
                }
              />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

/** The game's cover as the server's icon, with the Discord badge on its corner. */
function ServerIcon({ coverUrl }: { readonly coverUrl: string | null }) {
  return (
    <span className="relative size-16 shrink-0">
      {coverUrl ? (
        <img src={coverUrl} alt="" className="block size-16 rounded-2xl object-cover" />
      ) : (
        <span className="bg-raised-2 block size-16 rounded-2xl" />
      )}
      <span className="bg-ds-discord absolute -right-1.25 -bottom-1.25 flex size-6 items-center justify-center rounded-full text-white shadow-[0_0_0_3px_#3941a5]">
        <DiscordIcon aria-hidden="true" className="size-3.25" />
      </span>
    </span>
  )
}

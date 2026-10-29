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
 * The invite while the Squad forms (reference, DiscordInvite): a lock, what it waits for and a masked
 * link. The mask is not the invite, so it never carries a character of it. It fills the members column
 * and is as tall as the Ready panel it gives way to, so the column does not jump.
 */
export function LockedInvite() {
  const t = useTranslations('ds.invite')

  return (
    <section
      aria-labelledby="lobby-invite-locked-heading"
      className="bg-panel @container relative flex min-h-38 flex-col justify-center gap-2.5 px-4.5 py-4"
    >
      <div className="flex items-center gap-3">
        <span className="bg-raised text-discord-soft flex size-10 shrink-0 items-center justify-center">
          <Lock aria-hidden="true" className="size-4.5 stroke-[2.4]" />
        </span>
        <h2 id="lobby-invite-locked-heading" className="text-[15px] font-extrabold">
          {t('lockedTitle')}
        </h2>
      </div>
      <p className="text-text-3 pl-13 text-[13px] leading-normal">{t('lockedBody')}</p>
      <span
        aria-hidden="true"
        className="font-ds-mono pl-13 text-[12.5px] tracking-[0.04em] text-[#4a4c54] @[28rem]:absolute @[28rem]:top-1/2 @[28rem]:right-4.5 @[28rem]:-translate-y-1/2 @[28rem]:pl-0"
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
 * from the snapshot alone. It fills the members column, so it is laid out as a compact block: the title,
 * then one server card with the icon, the counts, the link and both actions. The sheen sweeps once on
 * entry and never loops.
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
        'bg-ds-discord @container relative overflow-hidden text-white',
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
        className="absolute -right-4 -bottom-7 size-32 text-white opacity-16"
      />

      <div className="relative flex flex-col gap-1.5 p-2.5">
        <h2
          id="lobby-invite-heading"
          className="font-display truncate text-[20px] leading-none font-black uppercase"
        >
          {t('title')}
        </h2>

        <div className="bg-bg/30 flex flex-col">
          <div className="flex items-center gap-2.5 px-2.5 py-1">
            <ServerIcon coverUrl={coverUrl} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="type-label truncate text-[10px] leading-none text-white/65">
                {t('serverInvite')}
              </span>
              <span className="truncate text-[15px]/4 font-extrabold">{squadName}</span>
              <span className="flex flex-wrap items-center gap-x-3 text-[11px] leading-3.5 font-semibold text-white/80">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="bg-mint size-1.5 rounded-full" />
                  {t('inRoomNow', { count: online })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-white/55" />
                  {t('players', { count: members })}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1 border-t border-white/10 px-2.5 py-1 @[30rem]:flex-row @[30rem]:items-center @[30rem]:gap-2.5">
            <span className="flex min-w-0 items-center gap-2 @[30rem]:flex-1">
              <LinkIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 stroke-[2.4] text-white/70"
              />
              <span className="font-ds-mono min-w-0 flex-1 truncate text-[12.5px]/3.5 font-bold">
                <span className="text-white/60">{invite.host}</span>
                {invite.code}
              </span>
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="glass"
                size="sm"
                aria-label={copyLabel}
                className="min-w-0 flex-1 px-2.5 @[30rem]:flex-none"
                onClick={() => void copyInvite()}
              >
                <CopySwap
                  gap="gap-1.5"
                  copied={copied}
                  idle={
                    <>
                      {t('copyLink')}
                      <Copy className="size-3.5" />
                    </>
                  }
                  done={
                    <>
                      {t('copied')}
                      <Check className="size-3.5" />
                    </>
                  }
                />
              </Button>
              <Button
                variant="light"
                size="sm"
                href={invite.href}
                target="_blank"
                rel="noopener noreferrer"
                icon={<ExternalLink />}
                iconPosition="end"
                className="min-w-0 flex-1 px-2.5 @[30rem]:flex-none"
              >
                {t('open')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** The game's cover as the server's icon, with the Discord badge on its corner. */
function ServerIcon({ coverUrl }: { readonly coverUrl: string | null }) {
  return (
    <span className="relative size-11 shrink-0">
      {coverUrl ? (
        <img src={coverUrl} alt="" className="block size-11 rounded-xl object-cover" />
      ) : (
        <span className="bg-raised-2 block size-11 rounded-xl" />
      )}
      <span className="bg-ds-discord absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full text-white shadow-[0_0_0_2px_#3941a5]">
        <DiscordIcon aria-hidden="true" className="size-2.75" />
      </span>
    </span>
  )
}

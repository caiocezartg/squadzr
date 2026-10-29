'use client'

import type { ReactNode } from 'react'
import { Check, Copy, ExternalLink, Link as LinkIcon, Lock } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import type { DiscordInviteLink, DiscordServerPreviewDto } from '@squadzr/schemas'
import { Button } from '@/components/ds/button'
import { CopySwap } from '@/components/ds/copy-swap'
import { SlotMeter } from '@/components/ds/slot-meter'
import { DiscordIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { useCopiedFlag } from '../use-copied-flag'

/** How long the link row's copy button says "Copied" (reference, DiscordInvite). */
const COPIED_MS = 1_800

/** What the invite's mask shows in place of the link, while the Squad forms. */
const MASKED_LINK = 'discord.gg/••••••••'

/** The link row, whose two actions sit beside it from this width of the panel and under it below. */
const FOOTER_CLASSES =
  'flex flex-col gap-2.5 border-t px-3.5 py-3 @2xl:flex-row @2xl:items-center @2xl:gap-3'
const ACTIONS_CLASSES = 'grid grid-cols-2 gap-2 @2xl:flex @2xl:shrink-0'
const ACTION_CLASSES = 'max-sm:px-2.5 @2xl:px-4'

/** The two actions of the locked panel, dimmed until the Squad completes. */
const DIMMED_ACTIONS = [
  ['copyLink', Copy],
  ['open', ExternalLink],
] as const

/** The display title both panels open with. */
const TITLE_CLASSES = 'font-display text-[34px] leading-none font-black uppercase @2xl:text-[40px]'

interface LockedInviteProps {
  /** Members the Squad has. */
  readonly filled: number
  readonly total: number
}

/**
 * The invite panel while the Squad forms (reference, DiscordInvite): a lock, what it waits for, how many
 * slots are left and the masked link over the two actions, dimmed. It takes the Ready panel's place and
 * about its height, so the column does not jump when the Squad completes. The mask is not the invite, so it
 * never carries a character of it.
 */
export function LockedInvite({ filled, total }: LockedInviteProps) {
  const t = useTranslations('ds.invite')

  return (
    <section aria-labelledby="lobby-invite-locked-heading" className="bg-panel @container">
      <div className="flex flex-col gap-3.5 p-4.5 sm:p-5">
        <h2 id="lobby-invite-locked-heading" className={cn(TITLE_CLASSES, 'text-text-2')}>
          {t('lockedTitle')}
        </h2>

        <div className="bg-bg/45 flex flex-col">
          <div className="flex items-center gap-3.5 px-3.5 pt-3.5 pb-3">
            <span className="bg-raised text-discord-soft flex size-13 shrink-0 items-center justify-center rounded-2xl">
              <Lock aria-hidden="true" className="size-5.5 stroke-[2.4]" />
            </span>
            <p className="text-text-3 text-[14px] leading-snug font-semibold">{t('lockedBody')}</p>
          </div>
          <div className="border-line flex h-16.5 items-center justify-between gap-4 border-t px-3.5">
            <SlotMeter filled={filled} total={total} tone="discord" />
            <span className="type-label text-text-3 shrink-0 text-right">
              {t('slotsLeft', { count: Math.max(0, total - filled) })}
            </span>
          </div>
          <LinkRow
            tone="border-line text-[#4a4c54]"
            link={MASKED_LINK}
            actions={DIMMED_ACTIONS.map(([label, Icon]) => (
              <Button key={label} variant="secondary" disabled className={ACTION_CLASSES}>
                {t(label)}
                <Icon />
              </Button>
            ))}
          />
        </div>
      </div>
    </section>
  )
}

interface ReadyInviteProps {
  readonly invite: DiscordInviteLink
  /** The Squad's name, which the server card carries when Discord has nothing better. */
  readonly squadName: string
  /** The game's cover, which stands in as the server's icon. */
  readonly coverUrl: string | null
  /** Members in the room now, from Presence. */
  readonly online: number
  readonly members: number
  /** The Discord server behind the invite. `null` falls back to the Squad's own name, cover and counts. */
  readonly preview: DiscordServerPreviewDto | null
  /** The preview is still being read for the first time: the card holds its place with a skeleton. */
  readonly previewPending: boolean
  /** The viewer watched the Squad complete: the panel enters, and the sheen sweeps once. */
  readonly entering: boolean
}

/**
 * The invite once the last slot closes (reference, DiscordInvite): the "Bora pro Discord" panel. Its card
 * shows the Discord server (icon, name and counts, over its banner) when the API could read the invite, and
 * the Squad's own cover, name and counts otherwise. Either way the card has the same structure, so nothing
 * moves when the server arrives. The sheen sweeps once on entry and never loops.
 */
export function ReadyInvite({
  invite,
  squadName,
  coverUrl,
  online,
  members,
  preview,
  previewPending,
  entering,
}: ReadyInviteProps) {
  const t = useTranslations('ds.invite')
  const format = useFormatter()
  const [copied, markCopied] = useCopiedFlag(COPIED_MS)

  const copyInvite = async () => {
    await navigator.clipboard.writeText(invite.href)
    markCopied()
  }
  const copyLabel = copied ? t('copied') : t('copyLink')
  const backdropUrl = preview?.backdropUrl ?? null

  const inRoom = { value: online, label: t('statInRoom'), dot: 'bg-mint' }
  const stats: readonly Stat[] =
    preview?.onlineCount != null && preview.memberCount != null
      ? [
          { value: preview.onlineCount, label: t('statOnline'), dot: 'bg-[#43e08a]' },
          {
            value: preview.memberCount,
            label: t('statMembers', { count: preview.memberCount }),
            dot: 'bg-white/55',
          },
          inRoom,
        ]
      : [
          inRoom,
          { value: members, label: t('statPlayers', { count: members }), dot: 'bg-white/55' },
        ]

  return (
    <section
      aria-labelledby="lobby-invite-heading"
      className={cn(
        'bg-ds-discord @container relative overflow-hidden text-white',
        entering && 'motion-safe:animate-invite-enter motion-reduce:animate-invite-fade'
      )}
    >
      {backdropUrl ? (
        <>
          <img
            src={backdropUrl}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-30"
          />
          <span
            aria-hidden="true"
            className="from-ds-discord/20 to-ds-discord absolute inset-0 bg-linear-to-b"
          />
        </>
      ) : (
        <DiscordIcon
          aria-hidden="true"
          className="absolute -right-8 -bottom-12 size-52 text-white opacity-14"
        />
      )}
      {entering && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 hidden w-[24%] bg-linear-to-r from-white/0 via-white/14 to-white/0 motion-safe:block motion-safe:animate-invite-sheen"
        />
      )}

      <div className="relative flex flex-col gap-3.5 p-4.5 sm:p-5">
        <h2 id="lobby-invite-heading" className={TITLE_CLASSES}>
          {t('title')}
        </h2>

        <div className="bg-bg/32 flex flex-col">
          <div className="flex items-center gap-3.5 px-3.5 pt-3.5 pb-3">
            <ServerIcon src={preview?.iconUrl ?? coverUrl} pending={previewPending} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="type-label text-white/75">{t('serverInvite')}</span>
              {previewPending ? (
                <Skeleton className="h-5.5 w-3/5" />
              ) : (
                <span className="truncate text-[19px]/6 font-extrabold">
                  {preview?.name ?? squadName}
                </span>
              )}
            </div>
          </div>

          <dl className="flex gap-3 border-t border-white/10 px-3.5 py-2.5">
            {previewPending ? (
              <div className="flex-1">
                <Skeleton className="h-11 w-full" />
              </div>
            ) : (
              stats.map((stat) => (
                <div key={stat.label} className="flex min-w-0 flex-1 flex-col-reverse gap-0.5">
                  <dt className="flex items-center gap-1.75 text-[12px] font-semibold text-white/80">
                    <span
                      aria-hidden="true"
                      className={cn('size-2 shrink-0 rounded-full', stat.dot)}
                    />
                    <span className="truncate">{stat.label}</span>
                  </dt>
                  <dd className="font-display text-[22px] leading-6 font-extrabold tabular-nums">
                    {format.number(stat.value)}
                  </dd>
                </div>
              ))
            )}
          </dl>

          <LinkRow
            tone="border-white/10 text-white"
            link={
              <>
                <span className="text-white/60">{invite.host}</span>
                {invite.code}
              </>
            }
            actions={
              <>
                <Button
                  variant="glass"
                  aria-label={copyLabel}
                  className={ACTION_CLASSES}
                  onClick={() => void copyInvite()}
                >
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
                <Button
                  variant="light"
                  href={invite.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  icon={<ExternalLink />}
                  iconPosition="end"
                  className={ACTION_CLASSES}
                >
                  {t('open')}
                </Button>
              </>
            }
          />
        </div>
      </div>
    </section>
  )
}

interface LinkRowProps {
  /** The border and text colours of the row. */
  readonly tone: string
  readonly link: ReactNode
  readonly actions: ReactNode
}

/** The invite's link row: the link, and the two actions beside it or under it. */
function LinkRow({ tone, link, actions }: LinkRowProps) {
  return (
    <div className={cn(FOOTER_CLASSES, tone)}>
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <LinkIcon aria-hidden="true" className="size-4 shrink-0 stroke-[2.4] opacity-70" />
        <span className="font-ds-mono min-w-0 flex-1 truncate text-[14px] font-bold">{link}</span>
      </span>
      <div className={ACTIONS_CLASSES}>{actions}</div>
    </div>
  )
}

interface Stat {
  readonly value: number
  readonly label: string
  /** The class that colours the dot before the label. */
  readonly dot: string
}

function Skeleton({ className }: { readonly className: string }) {
  return <span className={cn('block bg-white/16 motion-safe:animate-pulse', className)} />
}

interface ServerIconProps {
  /** The Discord server's icon, or the game's cover when Discord has none. */
  readonly src: string | null
  readonly pending: boolean
}

/** The server's icon with the Discord badge on its corner. */
function ServerIcon({ src, pending }: ServerIconProps) {
  return (
    <span className="relative size-13 shrink-0">
      {pending ? (
        <Skeleton className="size-13 rounded-2xl" />
      ) : (
        src && <img src={src} alt="" className="block size-13 rounded-2xl object-cover" />
      )}
      <span className="bg-ds-discord absolute -right-1 -bottom-1 flex size-5.5 items-center justify-center rounded-full text-white shadow-[0_0_0_2px_#3941a5]">
        <DiscordIcon aria-hidden="true" className="size-3" />
      </span>
    </span>
  )
}

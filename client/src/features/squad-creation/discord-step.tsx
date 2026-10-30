'use client'

import { useId } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Check, Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DiscordIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import type { Game } from '@/types'
import type { FormInput, FormValues } from './create-squad-form'
import { checkDiscordLink } from './discord-link'
import { DiscordServerRow } from './discord-server-row'
import { FormField } from './form-field'
import { SquadPreview } from './squad-preview'
import type { DiscordInviteState } from './use-discord-invite-check'

export interface DiscordStepProps {
  game: Game
  /** What Discord says about the invite in the field. */
  invite: DiscordInviteState
}

/**
 * Step 3: the Discord invite with live validation by the contract's own rule and then by Discord, a
 * hint about who sees it, and a preview of the Squad's card. The mark and the message follow what the
 * player has typed; an empty field says nothing until the form is submitted. A link the contract accepts
 * is checked with Discord: it shows the server behind it, warns when it expires, and is refused when
 * Discord does not know it. When Discord cannot be asked the link stays valid and the server checks it.
 */
export function DiscordStep({ game, invite }: DiscordStepProps) {
  const t = useTranslations()
  const inputId = useId()
  const errorId = useId()
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormInput, unknown, FormValues>()
  const link = useWatch({ control, name: 'discordLink' }) ?? ''

  const check = checkDiscordLink(link)
  const showsError = !check.valid && (link !== '' || errors.discordLink !== undefined)
  // Discord does not know the invite: it told so while the player typed, or the server did on submit.
  const refused =
    check.valid && (invite.status === 'invalid' || errors.discordLink?.type === 'server')
  const checking = link !== '' && check.valid && invite.status === 'checking'
  const valid = link !== '' && check.valid && !refused && !checking
  const errorMessage = !check.valid
    ? showsError
      ? t(`squads.createModal.${check.errorKey}`)
      : undefined
    : refused
      ? t('errors.INVALID_DISCORD_INVITE')
      : undefined
  const server = valid && invite.status === 'valid' ? invite.server : null
  const announcement = server
    ? t('ds.createSquad.discordServerAnnouncement', { name: server.name })
    : valid
      ? t('ds.createSquad.discordValidAnnouncement')
      : ''

  return (
    <>
      <div className="flex flex-col gap-2">
        <FormField
          htmlFor={inputId}
          label={t('ds.createSquad.discordLabel')}
          errorId={errorId}
          error={errorMessage}
        >
          <span
            className={cn(
              'flex min-h-13 items-center gap-2.5 bg-[#0c0d10] px-3.5',
              valid
                ? 'shadow-[inset_0_0_0_1.5px_var(--color-mint)]'
                : errorMessage
                  ? 'shadow-[inset_0_0_0_1.5px_var(--color-ds-danger)]'
                  : 'shadow-[inset_0_0_0_1.5px_var(--color-track)] focus-within:shadow-[inset_0_0_0_1.5px_var(--color-mint)]'
            )}
          >
            <DiscordIcon aria-hidden className="text-discord-soft size-4.5 shrink-0" />
            <input
              id={inputId}
              type="url"
              autoComplete="off"
              aria-invalid={errorMessage ? true : undefined}
              aria-describedby={errorMessage ? errorId : undefined}
              placeholder={t('ds.createSquad.discordPlaceholder')}
              className="text-text placeholder:text-faint font-ds-mono min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold outline-none"
              {...register('discordLink')}
            />
            {checking && (
              <span className="font-ds-mono text-ds-muted inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold">
                <span
                  aria-hidden
                  className="bg-ds-muted size-1.75 rounded-full motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]"
                />
                {t('ds.createSquad.discordChecking')}
              </span>
            )}
            {valid && (
              <span className="font-ds-mono text-mint inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold">
                <Check aria-hidden className="size-3" strokeWidth={3.2} />
                {t('ds.createSquad.discordValid')}
              </span>
            )}
          </span>
        </FormField>
        {server && (
          <DiscordServerRow
            name={server.name}
            iconUrl={server.iconUrl}
            memberCount={server.memberCount}
          />
        )}
        {valid && invite.status === 'valid' && invite.expires && (
          <p className="text-amber text-[12.5px] leading-normal">
            {t('ds.createSquad.discordExpires')}
          </p>
        )}
        {valid && invite.status === 'unknown' && (
          <p className="text-ds-muted text-[12.5px] leading-normal">
            {t('ds.createSquad.discordUnknown')}
          </p>
        )}
        <p role="status" className="sr-only">
          {announcement}
        </p>
        <p className="text-text-3 flex gap-2 text-[12.5px] leading-normal">
          <Lock aria-hidden className="text-ds-muted mt-0.5 size-3.5 shrink-0" strokeWidth={2.4} />
          {t('ds.createSquad.discordHint')}
        </p>
      </div>

      <SquadPreview game={game} />
    </>
  )
}

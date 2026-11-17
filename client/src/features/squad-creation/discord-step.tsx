'use client'

import { useId, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Check, CircleHelp, Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DiscordIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import type { Game } from '@/types'
import type { FormInput, FormValues } from './create-squad-form'
import { DiscordCallRow } from './discord-call-row'
import { discordInviteIssue, isDiscordServerErrorCode } from './discord-invite-issue'
import { DiscordIssueAction } from './discord-issue-action'
import { checkDiscordLink } from './discord-link'
import { DiscordServerRow } from './discord-server-row'
import { FormField } from './form-field'
import { SquadPreview } from './squad-preview'
import type { DiscordInviteState } from './use-discord-invite-check'
import { VoiceCallHelpDialog } from './voice-call-help-dialog'

export interface DiscordStepProps {
  game: Game
  /** What Discord says about the invite in the field. */
  invite: DiscordInviteState
  /** Asks Discord again about the invite, past the answer the browser holds. */
  onRetryInvite: () => void
}

/**
 * Step 3: the Discord invite with live validation by the contract's own rule and then by Discord, a
 * hint about who sees it, and a preview of the Squad's card. The mark and the message follow what the
 * player has typed; an empty field says nothing until the form is submitted. A link the contract accepts
 * is checked with Discord: it shows the server and the voice call behind it, warns when it expires, and
 * is refused when Discord does not know it or it points to no voice call. When Discord cannot be asked
 * the field says so and offers a retry, because a Squad is never created without a call. A help dialog
 * shows how to copy an invite from a voice call.
 */
export function DiscordStep({ game, invite, onRetryInvite }: DiscordStepProps) {
  const t = useTranslations()
  const inputId = useId()
  const errorId = useId()
  const [helpOpen, setHelpOpen] = useState(false)
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormInput, unknown, FormValues>()
  const link = useWatch({ control, name: 'discordLink' }) ?? ''

  const check = checkDiscordLink(link)
  const showsError = !check.valid && (link !== '' || errors.discordLink !== undefined)
  // What the server answered on submit wins over what Discord said while the player typed.
  const serverMessage = errors.discordLink?.message
  const serverCode =
    errors.discordLink?.type === 'server' && isDiscordServerErrorCode(serverMessage)
      ? serverMessage
      : null
  const issue = check.valid ? discordInviteIssue(invite, serverCode) : null
  const checking = link !== '' && check.valid && invite.status === 'checking'
  const valid = link !== '' && check.valid && issue === null && !checking
  const errorMessage = !check.valid
    ? showsError
      ? t(`squads.createModal.${check.errorKey}`)
      : undefined
    : issue
      ? t(`errors.${issue.code}`)
      : undefined
  const server = valid && invite.status === 'valid' ? invite.server : null
  const call = valid && invite.status === 'valid' ? invite.call : null
  const announcement =
    server && call
      ? t('ds.createSquad.discordServerAnnouncement', { name: server.name, call: call.name })
      : valid
        ? t('ds.createSquad.discordValidAnnouncement')
        : checking
          ? t('ds.createSquad.discordCheckingAnnouncement')
          : ''

  return (
    <>
      <div className="flex flex-col gap-2">
        <FormField
          htmlFor={inputId}
          label={t('ds.createSquad.discordLabel')}
          labelAction={
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label={t('ds.createSquad.voiceCallHelp.trigger')}
              title={t('ds.createSquad.voiceCallHelp.trigger')}
              className="text-mint hover-fine:text-text focus-visible:outline-mint -m-1.5 inline-flex size-7 items-center justify-center rounded-full focus-visible:outline-2"
            >
              <CircleHelp aria-hidden className="size-4" strokeWidth={2.4} />
            </button>
          }
          errorId={errorId}
          error={errorMessage}
          errorAction={
            <DiscordIssueAction
              issue={issue}
              onRetry={onRetryInvite}
              onHelp={() => setHelpOpen(true)}
            />
          }
        >
          <span
            className={cn(
              'flex min-h-13 items-center gap-2.5 bg-[#0c0d10] px-3.5',
              valid
                ? 'shadow-[inset_0_0_0_1.5px_var(--color-mint)]'
                : errorMessage
                  ? 'shadow-[inset_0_0_0_1.5px_var(--color-danger)]'
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
              className="text-text placeholder:text-faint font-mono min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold outline-none"
              {...register('discordLink')}
            />
            {checking && (
              <span className="font-mono text-muted inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold">
                <span
                  aria-hidden
                  className="bg-muted size-1.75 rounded-full motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]"
                />
                {t('ds.createSquad.discordChecking')}
              </span>
            )}
            {valid && (
              <span className="font-mono text-mint inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold">
                <Check aria-hidden className="size-3" strokeWidth={3.2} />
                {t('ds.createSquad.discordValid')}
              </span>
            )}
          </span>
        </FormField>
        {server && (
          <div className="flex flex-col">
            <DiscordServerRow
              name={server.name}
              iconUrl={server.iconUrl}
              memberCount={server.memberCount}
            />
            {call && <DiscordCallRow name={call.name} />}
          </div>
        )}
        {valid && invite.status === 'valid' && invite.expires && (
          <p className="text-amber text-[12.5px] leading-normal">
            {t('ds.createSquad.discordExpires')}
          </p>
        )}
        <VoiceCallHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
        <p role="status" className="sr-only">
          {announcement}
        </p>
        <p className="text-text-3 flex gap-2 text-[12.5px] leading-normal">
          <Lock aria-hidden className="text-muted mt-0.5 size-3.5 shrink-0" strokeWidth={2.4} />
          {t('ds.createSquad.discordHint')}
        </p>
      </div>

      <SquadPreview game={game} />
    </>
  )
}

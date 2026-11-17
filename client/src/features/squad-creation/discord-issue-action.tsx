import { RotateCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import type { DiscordInviteIssue } from './discord-invite-issue'

export interface DiscordIssueActionProps {
  issue: DiscordInviteIssue | null
  onRetry: () => void
  onHelp: () => void
}

/**
 * What the player can do about the invite's issue, on the error's line: ask Discord again when it
 * could not be reached, or see how to copy a voice call's invite when the link points elsewhere. The
 * outage keeps the danger tone of the field, because it blocks the submit like any other issue; the
 * retry is what tells it apart as recoverable.
 */
export function DiscordIssueAction({ issue, onRetry, onHelp }: DiscordIssueActionProps) {
  const t = useTranslations('ds.createSquad')

  if (issue?.retryable) {
    return (
      <Button variant="secondary" size="sm" icon={<RotateCw />} onClick={onRetry}>
        {t('discordRetry')}
      </Button>
    )
  }
  if (issue?.code === 'DISCORD_INVITE_NOT_VOICE_CALL') {
    return (
      <button
        type="button"
        onClick={onHelp}
        className="text-mint hover-fine:text-mint-hover focus-visible:outline-mint text-[12.5px] leading-normal font-bold underline decoration-1 underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {t('discordHelpInline')}
      </button>
    )
  }
  return null
}

import { useState } from 'react'
import * as motion from 'motion/react-client'
import { Copy, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DiscordIcon } from '@/components/ui/icons'

interface DiscordLinkCardProps {
  discordLink: string
  isRoomReady: boolean
}

export function DiscordLinkCard({ discordLink, isRoomReady }: DiscordLinkCardProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(discordLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isValidDiscordLink =
    discordLink.startsWith('https://discord.gg/') ||
    discordLink.startsWith('https://discord.com/invite/')

  if (!isRoomReady || !isValidDiscordLink) return null

  return (
    <motion.div
      className="relative rounded-2xl border border-discord/30 bg-discord/5 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Subtle animated glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-discord/10 via-discord/5 to-discord/10 blur-xl animate-pulse-glow" />

      <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Icon + text */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="size-12 rounded-xl bg-discord/15 border border-discord/25 flex items-center justify-center shrink-0">
            <DiscordIcon className="size-6 text-discord" />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-base font-bold text-offwhite">
              {t('rooms.discordCard.title')}
            </h3>
            <p className="text-sm text-muted mt-0.5">{t('rooms.discordCard.description')}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col md:flex-row items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg bg-surface border border-border-light px-5 py-2.5 text-xs font-medium text-muted hover:text-offwhite hover:border-muted/30 transition-colors"
          >
            <Copy className="size-3.5" />
            {copied ? t('rooms.discordCard.copied') : t('rooms.discordCard.copyLink')}
          </button>
          <a
            href={discordLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-discord gap-2 px-5 py-2.5"
          >
            <ExternalLink className="size-4" />
            {t('rooms.discordCard.joinDiscord')}
          </a>
        </div>
      </div>
    </motion.div>
  )
}

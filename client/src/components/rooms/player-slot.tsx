import * as motion from 'motion/react-client'
import { User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PresenceIndicator } from '@/components/rooms/presence-indicator'
import type { Player } from '@/types'

interface PlayerSlotProps {
  player?: Player
  index: number
  /** Authoritative Presence from the room snapshot; unknown members read offline. */
  online?: boolean
}

export function PlayerSlot({ player, index, online = false }: PlayerSlotProps) {
  const { t } = useTranslation()

  if (!player) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border-light p-3 opacity-40">
        <div className="size-10 rounded-full bg-surface-light border border-border flex items-center justify-center">
          <User className="size-4 text-muted" />
        </div>
        <span className="text-sm text-muted">{t('rooms.lobby.waitingForPlayer')}</span>
      </div>
    )
  }

  return (
    <motion.div
      className="flex items-center gap-3 rounded-xl border border-border bg-surface-hover/50 p-3"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      {player.image ? (
        <img
          src={player.image}
          alt={player.name}
          className="size-10 rounded-full border border-accent/20 object-cover shrink-0"
        />
      ) : (
        <div className="size-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-sm font-bold text-accent shrink-0">
          {player.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-offwhite truncate">{player.name}</p>
      </div>
      <PresenceIndicator online={online} />
      {player.isHost && <span className="badge-accent text-[10px] shrink-0">Host</span>}
    </motion.div>
  )
}

'use client'

import { LockedInvite, ReadyInvite } from '@/features/lobby'
import { DEMO_TOTAL, demoCoverUrl, demoInvite, type DemoGame } from './hero-demo-data'

interface HeroDemoInviteProps {
  readonly game: DemoGame
  /** Members in the squad. */
  readonly filled: number
  /** The viewer watched the squad complete: the Ready panel enters, and its sheen sweeps once. */
  readonly entering: boolean
}

/**
 * The Lobby's Discord panel, with mock data: locked while the squad forms, and the Ready panel, with
 * its own entry and sheen, once the last slot closes. The demo has no real actions, so the parent keeps
 * the whole panel inert.
 */
export function HeroDemoInvite({ game, filled, entering }: HeroDemoInviteProps) {
  return (
    <div className="flex flex-1 [&>section]:flex-1">
      {filled < DEMO_TOTAL ? (
        <LockedInvite filled={filled} total={DEMO_TOTAL} />
      ) : (
        <ReadyInvite
          invite={demoInvite(game)}
          squadName={game.squad.name}
          coverUrl={demoCoverUrl(game)}
          online={DEMO_TOTAL}
          members={DEMO_TOTAL}
          preview={null}
          previewPending={false}
          entering={entering}
        />
      )}
    </div>
  )
}

'use client'

import * as m from 'motion/react-m'
import { Avatar } from '@/components/ds/avatar'
import { DEMO_MEMBERS, type DemoMember } from './hero-demo-data'

/** The panel's ground, which the host crown's ring blends into. */
const RAIL_SURFACE = 'var(--color-raised)'

/** The squad's first members are in it from the start; the later ones are the ones that join. */
const FOUNDING_MEMBERS = 2

/** A member's avatar, ringed in mint as the artboard draws every member of the rail. */
function MemberAvatar({ member }: { readonly member: DemoMember }) {
  return (
    <span className="ring-mint block rounded-full ring-2">
      <Avatar
        size={44}
        playerId={member.playerId}
        name={member.name}
        host={member.host}
        surface={RAIL_SURFACE}
      />
    </span>
  )
}

interface HeroDemoMembersProps {
  readonly filled: number
  /** Members that join from now on enter with their spring; without it they are simply there. */
  readonly scripted: boolean
}

/**
 * The five avatars of the squad. A slot that has not filled shows a vacant circle, and a member that
 * joins enters over it from `scale(0.9)` on a spring with bounce 0.15 (reference, Motion: Hero).
 */
export function HeroDemoMembers({ filled, scripted }: HeroDemoMembersProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-2.5 lg:gap-1.5 xl:gap-2">
      {DEMO_MEMBERS.map((member, index) => {
        if (index < FOUNDING_MEMBERS) {
          return (
            <div key={member.playerId} className="shrink-0">
              <MemberAvatar member={member} />
            </div>
          )
        }

        return (
          <div key={member.playerId} className="relative size-11 shrink-0">
            <Avatar size={44} state="vacant" />
            {index < filled && (
              <m.span
                className="absolute inset-0"
                initial={scripted ? { opacity: 0, transform: 'scale(0.9)' } : false}
                animate={{ opacity: 1, transform: 'scale(1)' }}
                transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
              >
                <MemberAvatar member={member} />
              </m.span>
            )}
          </div>
        )
      })}
    </div>
  )
}

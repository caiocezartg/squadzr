'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { pickAvatarColors } from '@/components/ds/avatar-colors'
import { DiscordIcon } from '@/components/ui/icons'
import { coverUrl } from './hero-showcase-data'

/*
  The three mockups of "Como funciona" (docs/design/Main.dc.html, #como-funciona). Each one is drawn
  in its final state: that is what the stacked cards, reduced motion and the server HTML show. The
  sticky stage plays each one's micro-animation once, from the `hiw-*` classes, whose keyframes
  (globals.css) start from the opening frame and end on this final state.
*/

/** The canvas's pointer, drawn over the mockups. */
function Cursor({ className }: { readonly className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="var(--color-text)"
      stroke="var(--color-bg)"
      strokeWidth="1.2"
    >
      <path d="M5 2v17l4.6-4.4 3.2 7.2 2.6-1.1-3.1-7.1H19L5 2z" />
    </svg>
  )
}

/** Step 1: the header's "Sign in with Discord" is clicked and turns into the player's chip. */
export function SignInMockup() {
  const t = useTranslations('landing.howItWorks')

  return (
    <div className="bg-card relative flex size-full items-center justify-center overflow-hidden">
      <span className="bg-menu absolute inset-x-0 top-0 flex h-11 items-center gap-2 px-3.5">
        <img src="/squadzr-logo.svg" alt="" className="block w-14.5 opacity-90" />
        <span className="font-ds-mono text-ds-muted ml-auto text-[10px]">PT</span>
      </span>
      <span className="relative mt-7.5 block h-12.5 w-52.5">
        <span className="hiw-s1-button bg-ds-discord absolute inset-0 flex items-center justify-center gap-2.25 text-sm font-bold text-white opacity-0">
          <DiscordIcon className="size-4.25" />
          {t('mockup.signIn')}
        </span>
        <span className="hiw-s1-chip bg-raised-2 absolute inset-0 flex items-center gap-2.5 pr-3.5 pl-2">
          {/* Signed in: the canvas marks it with a still presence dot, not the board's pulsing halo. */}
          <span className="relative block">
            <Avatar size={34} playerId="cc-2" name="caio_cz" />
            <span className="bg-mint ring-raised-2 absolute -right-px -bottom-px block size-2.75 rounded-full ring-2" />
          </span>
          <span className="text-text text-[13px] font-bold">caio_cz</span>
          <svg
            aria-hidden="true"
            className="ml-auto"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-ds-muted)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
        <Cursor className="hiw-s1-cursor absolute top-[58%] left-[60%] opacity-0" />
      </span>
    </div>
  )
}

/** The query the search types, one character per step of its animation (globals.css). */
const QUERY = 'valorant'

interface ResultRowProps {
  readonly name: string
  /** The members' player ids, which pick their colours. */
  readonly members: readonly string[]
  /** The open slots drawn after the members. */
  readonly openSlots: number
  readonly className: string
  readonly children?: ReactNode
}

/** One squad of the board's results, as compact as the canvas draws it. */
function ResultRow({ name, members, openSlots, className, children }: ResultRowProps) {
  return (
    <span className={`bg-raised relative flex items-center gap-2.5 p-1.5 ${className}`}>
      <img
        src={coverUrl('cocqbp')}
        alt=""
        decoding="async"
        className="bg-raised-2 block h-11.5 w-8.5 object-cover"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="font-ds-mono text-text-3 text-[9.5px] font-bold tracking-[0.12em]">
          VALORANT · PT-BR
        </span>
        <span className="text-text truncate text-[13px] font-extrabold">{name}</span>
      </span>
      {/* At 18px the canvas draws each member as their colour alone, with no initials. */}
      <span className="flex">
        {members.map((id) => (
          <span
            key={id}
            className="ring-raised -ml-1.25 block size-4.5 rounded-full ring-2 first:ml-0"
            style={{ backgroundColor: pickAvatarColors(id).background }}
          />
        ))}
        {Array.from({ length: openSlots }, (_, slot) => (
          <span
            key={slot}
            className="ring-raised -ml-1.25 block size-4.5 rounded-full bg-[#2a2b31] ring-2"
          />
        ))}
      </span>
      {children}
    </span>
  )
}

/** Step 2: the search types "valorant", the results come in and the first one is picked. */
export function FindSquadMockup() {
  const t = useTranslations('landing.howItWorks')

  return (
    <div className="bg-card relative flex size-full flex-col justify-center gap-2 overflow-hidden p-4">
      <span className="flex gap-1.5">
        <span className="bg-raised-2 flex h-9.5 flex-1 items-center gap-2 px-3">
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-ds-muted)"
            strokeWidth="2.6"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          {/*
            Mono, so each character is 0.6em wide: the cover slides off the query one character at a
            time and the caret steps along with it. At rest the cover is out of sight.
          */}
          <span className="font-ds-mono text-text relative block text-[13px] font-semibold">
            <span className="relative block overflow-hidden whitespace-nowrap">
              {QUERY}
              <span className="hiw-s2-cover bg-raised-2 absolute inset-0 block opacity-0" />
            </span>
            <span className="hiw-s2-caret bg-mint absolute top-0.5 -right-1 block h-3.75 w-[1.5px]" />
          </span>
        </span>
        <span className="bg-raised-2 text-text flex h-9.5 items-center gap-1.5 px-2.75 text-xs font-bold">
          {t('mockup.filters')}
          <span className="bg-mint text-mint-ink px-1.25 py-px text-[10px] font-extrabold">2</span>
        </span>
      </span>
      <ResultRow
        name="Premier quinta à noite"
        members={['cc-2', 'mf-7', 'br-0']}
        openSlots={1}
        className="hiw-s2-row1"
      >
        <span className="hiw-s2-pick pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1.5px_var(--color-mint)]" />
        <Cursor className="hiw-s2-cursor absolute right-6.5 -bottom-2 opacity-0" />
      </ResultRow>
      <ResultRow name="Unrated sem tilt" members={['kz-4']} openSlots={2} className="hiw-s2-row2" />
    </div>
  )
}

/** The three members already in when step 3 opens. */
const FOUNDERS = [
  { id: 'cc-2', name: 'caio_cz' },
  { id: 'mf-7', name: 'mia.f' },
  { id: 'br-0', name: 'brunão' },
] as const

/** The two members who close the team, each with the class that plays their join. */
const CLOSERS = [
  { id: 'kz-4', name: 'kz_dex', className: 'hiw-s3-join1' },
  { id: 'lu-4', name: 'luiza', className: 'hiw-s3-join2' },
] as const

/** Step 3: the last two members take the open slots and the Discord invite unlocks. */
export function CloseTeamMockup() {
  const t = useTranslations('landing.howItWorks')

  return (
    <div className="bg-card relative flex size-full flex-col justify-center gap-4 overflow-hidden px-4 py-4.5">
      <span className="flex gap-2">
        {FOUNDERS.map((member) => (
          <span key={member.id} className="ring-mint block rounded-full ring-2">
            <Avatar size={36} playerId={member.id} name={member.name} />
          </span>
        ))}
        {CLOSERS.map((member) => (
          <span key={member.id} className="relative block size-9">
            <span className="bg-track absolute inset-0 rounded-full shadow-[inset_0_0_0_1.5px_#34353c]" />
            <span className={`ring-mint absolute inset-0 rounded-full ring-2 ${member.className}`}>
              <Avatar size={36} playerId={member.id} name={member.name} />
            </span>
          </span>
        ))}
      </span>
      <span className="hiw-s3-invite bg-ds-discord flex items-center gap-2.5 py-2.25 pr-2.5 pl-3 text-white">
        <DiscordIcon className="size-4.5" />
        <span className="flex-1 text-[12.5px] font-extrabold">{t('mockup.invite')}</span>
        <span className="bg-white px-2.5 py-1.5 text-[11.5px] font-extrabold text-[#2b33a8]">
          {t('mockup.open')}
        </span>
      </span>
    </div>
  )
}

/** The mockups in step order, each with a stable key. */
export const MOCKUPS = [
  { id: 'sign-in', Mockup: SignInMockup },
  { id: 'find-squad', Mockup: FindSquadMockup },
  { id: 'close-team', Mockup: CloseTeamMockup },
] as const

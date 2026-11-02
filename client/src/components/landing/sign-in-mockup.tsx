'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { DiscordIcon } from '@/components/ui/icons'
import { Pointer, Seat, type MockupProps, type Point } from './how-it-works-mockup-parts'
import { useMockupTimeline } from './use-mockup-timeline'

/**
 * 1 the pointer reaches the header's button · 2 hovers it · 3 presses it · 4 Discord's authorize card opens
 * · 5 the pointer reaches "Authorize" · 6 presses it · 7 the card closes and the header shows the player ·
 * 8 a toast confirms the sign-in.
 */
const SIGN_IN_CUES = [300, 850, 1000, 1150, 1500, 2100, 2250, 2600] as const

const SIGN_IN_POINTER: Record<'rest' | 'button' | 'authorize', Point> = {
  rest: { x: 330, y: 270 },
  button: { x: 296, y: 16 },
  authorize: { x: 186, y: 224 },
}

export function SignInMockup({ mode }: MockupProps) {
  const t = useTranslations('landing.howItWorks')
  const { beat, live } = useMockupTimeline(SIGN_IN_CUES, mode)
  const modalOpen = beat >= 4 && beat < 7
  const signedIn = beat >= 7
  const pointerAt =
    beat >= 5
      ? SIGN_IN_POINTER.authorize
      : beat >= 1
        ? SIGN_IN_POINTER.button
        : SIGN_IN_POINTER.rest

  return (
    <div className="bg-card relative size-full overflow-hidden">
      <span className="bg-menu absolute inset-x-0 top-0 z-10 flex h-11 items-center gap-2 px-3.5">
        <img src="/squadzr-logo.svg" alt="" className="block w-14.5 opacity-90" />
        <span className="font-ds-mono text-ds-muted ml-auto text-[10px]">PT</span>
        <span className="relative block h-7 w-32">
          <span
            data-hover={beat === 2 || beat === 3 ? '' : undefined}
            data-pressed={beat === 3 ? '' : undefined}
            data-gone={signedIn ? '' : undefined}
            className="bg-ds-discord data-hover:bg-discord-hover absolute inset-0 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white transition-[background-color,scale,opacity] duration-150 ease-(--ease-out) data-gone:scale-[0.96] data-gone:opacity-0 data-pressed:scale-[0.97]"
          >
            <DiscordIcon className="size-3.25" />
            {t('mockup.signIn')}
          </span>
          <span
            data-shown={signedIn ? '' : undefined}
            className="absolute inset-y-0 right-0 flex translate-y-1.5 items-center gap-2 opacity-0 transition-[opacity,translate] duration-300 ease-(--ease-out) data-shown:translate-y-0 data-shown:opacity-100"
          >
            <Seat
              id="cc-2"
              name="caio_cz"
              surface="var(--color-menu)"
              arriving={live && signedIn}
            />
            <span className="text-text text-[12px] font-bold">caio_cz</span>
          </span>
        </span>
      </span>

      {/* The landing behind the header, drawn as its shapes. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-20 flex flex-col items-center gap-2"
      >
        <span className="bg-raised block h-5 w-52" />
        <span className="bg-raised block h-5 w-36" />
        <span className="bg-raised-2 mt-1 block h-2 w-44" />
        <span className="mt-2.5 flex gap-2">
          <span className="bg-mint/80 block h-6.5 w-20" />
          <span className="bg-raised-2 block h-6.5 w-20" />
        </span>
      </span>

      <span
        data-open={modalOpen ? '' : undefined}
        className="absolute inset-x-0 top-11 bottom-0 bg-black/55 opacity-0 transition-opacity duration-150 ease-(--ease-out) data-open:opacity-100 data-open:duration-200"
      />
      <span
        data-open={modalOpen ? '' : undefined}
        className="bg-raised absolute top-15.5 left-17.5 z-10 flex w-60 scale-[0.96] flex-col gap-3 p-4 opacity-0 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] transition-[opacity,scale] duration-150 ease-(--ease-out) data-open:scale-100 data-open:opacity-100 data-open:duration-200"
      >
        <span className="flex h-9 items-center justify-center gap-2.5">
          <span className="bg-ds-discord flex size-9 items-center justify-center rounded-full text-white">
            <DiscordIcon className="size-4.5" />
          </span>
          <span className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="bg-ds-muted block size-1 rounded-full" />
            ))}
          </span>
          <span className="bg-mint text-mint-ink font-display flex size-9 items-center justify-center rounded-full text-[17px] font-black">
            S
          </span>
        </span>
        <span className="text-text text-center text-[12px]/4 font-bold">
          {t('mockup.authorizeTitle')}
        </span>
        <span className="bg-panel flex h-8 items-center gap-2 px-2">
          <Avatar size={28} playerId="cc-2" name="caio_cz" surface="var(--color-panel)" />
          <span className="text-text-2 text-[11.5px] font-bold">caio_cz</span>
        </span>
        <span
          data-pressed={beat === 6 ? '' : undefined}
          className="bg-ds-discord flex h-8 items-center justify-center text-[11.5px] font-extrabold text-white transition-[scale] duration-100 ease-out data-pressed:scale-[0.97]"
        >
          {t('mockup.authorize')}
        </span>
      </span>

      <span className="absolute inset-x-0 bottom-4 flex justify-center">
        <span
          data-shown={beat >= 8 ? '' : undefined}
          className="bg-raised-2 text-text flex translate-y-2 items-center gap-2 px-3 py-2 text-[11.5px] font-semibold opacity-0 shadow-[inset_0_0_0_1px_var(--color-line)] transition-[opacity,translate] duration-300 ease-(--ease-out) data-shown:translate-y-0 data-shown:opacity-100"
        >
          <span className="bg-mint text-mint-ink flex size-4 items-center justify-center rounded-full">
            <Check className="size-2.75" strokeWidth={3.5} />
          </span>
          {t('mockup.signedIn', { name: 'caio_cz' })}
        </span>
      </span>

      <Pointer at={pointerAt} shown={beat >= 1 && beat < 7} pressed={beat === 3 || beat === 6} />
    </div>
  )
}

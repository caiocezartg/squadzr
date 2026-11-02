'use client'

import { ArrowRight, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DiscordIcon } from '@/components/ui/icons'
import { Pointer, Seat, type MockupProps, type Point } from './how-it-works-mockup-parts'
import { useMockupTimeline } from './use-mockup-timeline'

/**
 * 1 the pointer reaches "Sign in with Discord" · 2 hovers it · 3 presses it · 4 the button connects to
 * Discord, its bar filling · 5 the card turns into the player, signed in, and the header shows them · 6 the
 * call to explore squads rises, which step 2 picks up.
 */
const SIGN_IN_CUES = [300, 850, 1000, 1150, 1850, 2250] as const

/** How long the connecting bar takes to fill: from beat 4 to beat 5. */
const CONNECT_MS = SIGN_IN_CUES[4] - SIGN_IN_CUES[3]

const SIGN_IN_POINTER: Record<'rest' | 'button', Point> = {
  rest: { x: 330, y: 270 },
  button: { x: 272, y: 220 },
}

/** The card's two faces cross over each other: the old one leaves faster than the new one enters. */
const FACE_GONE = 'transition-opacity duration-150 ease-(--ease-out) data-gone:opacity-0'
const FACE_SHOWN =
  'translate-y-1.5 opacity-0 transition-[opacity,translate] duration-300 ease-(--ease-out) data-shown:translate-y-0 data-shown:opacity-100'

/** The button's label, which swaps with a 2px blur bridge (reference, Copy feedback). */
const LABEL =
  'absolute inset-0 flex items-center justify-center gap-2.5 transition-[opacity,filter] duration-200 ease-(--ease-out)'

/**
 * Step 1: the landing's sign-in card. "Sign in with Discord" is pressed, connects, and the card becomes the
 * signed-in player, as the canvas's button turns into the player's chip.
 */
export function SignInMockup({ mode }: MockupProps) {
  const t = useTranslations('landing.howItWorks')
  const { beat, live } = useMockupTimeline(SIGN_IN_CUES, mode)
  const connecting = beat >= 4
  const signedIn = beat >= 5

  return (
    <div className="bg-card relative size-full overflow-hidden">
      <span className="bg-menu absolute inset-x-0 top-0 flex h-11 items-center gap-2 px-3.5">
        <img src="/squadzr-logo.svg" alt="" className="block w-14.5 opacity-90" />
        <span data-shown={signedIn ? '' : undefined} className={`ml-auto ${FACE_SHOWN}`}>
          <Seat id="cc-2" name="caio_cz" surface="var(--color-menu)" arriving={false} />
        </span>
      </span>

      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_62%,rgba(0,255,162,0.07),transparent_62%)]"
      />

      <span className="absolute inset-x-0 top-11 bottom-0 flex items-center justify-center">
        <span className="bg-raised relative block h-44 w-64 overflow-hidden shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)]">
          <span
            data-gone={signedIn ? '' : undefined}
            className={`absolute inset-0 flex flex-col gap-1.5 p-4 ${FACE_GONE}`}
          >
            <span className="font-display text-text text-[22px] leading-none font-black uppercase">
              {t('mockup.signInTitle')}
            </span>
            <span className="text-text-3 text-[11.5px] font-medium">{t('mockup.signInHint')}</span>
            <span
              data-hover={beat === 2 || beat === 3 ? '' : undefined}
              data-pressed={beat === 3 ? '' : undefined}
              className="bg-ds-discord data-hover:bg-discord-hover relative mt-auto block h-11 overflow-hidden text-[13px] font-bold text-white transition-[background-color,scale] duration-150 ease-(--ease-out) data-pressed:scale-[0.97]"
            >
              <span
                className={LABEL}
                style={connecting ? { opacity: 0, filter: 'blur(2px)' } : undefined}
              >
                <DiscordIcon className="size-4.5" />
                {t('mockup.signIn')}
              </span>
              <span
                className={LABEL}
                style={connecting ? undefined : { opacity: 0, filter: 'blur(2px)' }}
              >
                {t('mockup.connecting')}
              </span>
              <span
                className="absolute inset-x-0 bottom-0 block h-0.5 origin-left bg-white/70"
                style={{
                  transform: connecting ? 'scaleX(1)' : 'scaleX(0)',
                  transition: `transform ${CONNECT_MS}ms linear`,
                }}
              />
            </span>
          </span>

          <span
            data-shown={signedIn ? '' : undefined}
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 ${FACE_SHOWN}`}
          >
            <Seat
              id="cc-2"
              name="caio_cz"
              size={44}
              surface="var(--color-raised)"
              arriving={live && signedIn}
            />
            <span className="text-text text-[15px] leading-none font-extrabold">caio_cz</span>
            <span className="text-mint flex items-center gap-1 text-[11.5px] font-semibold">
              <Check className="size-3.25" strokeWidth={3} />
              {t('mockup.connected')}
            </span>
            <span
              data-shown={beat >= 6 ? '' : undefined}
              className={`bg-mint text-mint-ink mt-1 flex h-8 items-center gap-1.5 px-3 text-[11.5px] font-extrabold ${FACE_SHOWN}`}
            >
              {t('mockup.explore')}
              <ArrowRight className="size-3.25" strokeWidth={2.8} />
            </span>
          </span>
        </span>
      </span>

      <Pointer
        at={beat >= 1 ? SIGN_IN_POINTER.button : SIGN_IN_POINTER.rest}
        shown={beat >= 1 && beat < 4}
        pressed={beat === 3}
      />
    </div>
  )
}

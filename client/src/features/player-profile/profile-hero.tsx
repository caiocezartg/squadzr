'use client'

import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'

/** The header's ground when there is no cover: a mint glow and a Discord-blue one (issue #114, Estados). */
const NO_COVER_GROUND =
  'bg-[radial-gradient(60%_90%_at_25%_10%,rgba(0,255,162,0.16),transparent_70%),radial-gradient(50%_80%_at_90%_0%,rgba(78,90,232,0.18),transparent_70%)]'

interface ProfileHeroProps {
  /** The cover of the person's most played Game. Without it the header keeps its glow. */
  readonly coverUrl?: string | undefined
  /** The bottom sheet's header: shorter, with the grabber. */
  readonly compact: boolean
}

/**
 * The profile's header (docs/design/PlayerProfile.mockup.html). The cover of the most played Game,
 * blurred, sits under a fade into the panel colour. The glow of an empty profile is its ground the
 * whole time, so a cover still loading shows the glow and then fades in over it, and a cover the
 * browser already holds is in place from the first paint.
 */
export function ProfileHero({ coverUrl, compact }: ProfileHeroProps) {
  return (
    <div className={cn('relative overflow-hidden', compact ? 'h-29.5' : 'h-37.5')}>
      <div aria-hidden className={cn('absolute inset-0', NO_COVER_GROUND)} />
      {coverUrl && <HeroCover key={coverUrl} coverUrl={coverUrl} />}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,16,19,0.05)_0%,rgba(15,16,19,0.55)_55%,var(--color-panel)_100%)]"
      />
      {compact && (
        <span
          aria-hidden
          className="absolute top-2 left-1/2 z-10 h-1 w-9 -translate-x-1/2 bg-white/28"
        />
      )}
    </div>
  )
}

function HeroCover({ coverUrl }: { readonly coverUrl: string }) {
  const [loaded, setLoaded] = useState(false)

  // An image the browser already holds is complete when it attaches, before the load event can be heard.
  const checkAttached = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true)
  }, [])

  return (
    <img
      ref={checkAttached}
      src={coverUrl}
      alt=""
      onLoad={() => setLoaded(true)}
      data-loaded={loaded ? '' : undefined}
      className="absolute -inset-7.5 size-[calc(100%+3.75rem)] scale-115 object-cover object-[50%_30%] opacity-0 blur-[14px] saturate-125 transition-opacity duration-200 ease-out data-loaded:opacity-75"
    />
  )
}

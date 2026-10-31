import { cn } from '@/lib/utils'
import { demoArtUrl, type DemoGame } from './hero-demo-data'

/** Film grain: a tile of SVG noise, laid over the art so its gradients never band. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

interface HeroBackdropProps {
  /** The game on the stage, and every game the viewer has picked, whose art stays loaded. */
  readonly game: DemoGame
  readonly games: readonly DemoGame[]
}

/**
 * The hero's atmosphere, behind everything: the game's key art, blurred into coloured light, a spotlight
 * falling from the top onto the stage, a vignette, film grain, and a fade into the page ground at the
 * bottom, so the hero runs into the next section with no edge. It reaches up under the sticky header,
 * which is clear at the top of the page, however many rows the header takes. The art layer (`data-parallax`) drifts
 * against the pointer (`useHeroPointer`). It is all decoration.
 */
export function HeroBackdrop({ game, games }: HeroBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-40 bottom-0 -z-10 overflow-hidden"
    >
      <div
        data-parallax=""
        className="absolute -inset-8 transition-transform duration-700 ease-out will-change-transform"
      >
        {games.map((entry) => (
          <img
            key={entry.id}
            src={demoArtUrl(entry)}
            alt=""
            decoding="async"
            fetchPriority={entry.id === game.id ? 'high' : 'low'}
            className={cn(
              'absolute inset-0 size-full scale-110 object-cover object-[50%_25%] opacity-0 blur-2xl saturate-150 transition-opacity duration-700 ease-out',
              entry.id === game.id && 'opacity-45'
            )}
          />
        ))}
      </div>
      {/* The spotlight on the stage, and the vignette that keeps the corners in the dark. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_62%,rgba(255,255,255,0.07),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_45%,transparent_30%,var(--color-background)_100%)]" />
      <div className="from-background/70 to-background absolute inset-0 bg-linear-to-b via-transparent via-45%" />
      <div
        className="absolute inset-0 opacity-7 mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
    </div>
  )
}

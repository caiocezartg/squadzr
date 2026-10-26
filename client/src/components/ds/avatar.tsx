'use client'

import { useCallback, useState } from 'react'
import Image from 'next/image'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { pickAvatarColors } from './avatar-colors'

export type AvatarSize = 28 | 34 | 36 | 44

/**
 * `online`: in the room now. `away`: joined, out of the room. `open`: a slot waiting for a player.
 * `vacant`: an empty slot in a card's rail. `none`: no presence to show.
 */
export type AvatarState = 'online' | 'away' | 'open' | 'vacant' | 'none'

interface SizeStyle {
  readonly circle: string
  readonly initials: string
  readonly plus: string
  readonly crown: string
  /** The crown's icon size in pixels. */
  readonly crownIcon: number
}

const SIZE_STYLES: Record<AvatarSize, SizeStyle> = {
  28: {
    circle: 'size-7',
    initials: 'text-[10px]',
    plus: 'size-2.5',
    crown: 'size-3.5 -top-[7px]',
    crownIcon: 8,
  },
  34: {
    circle: 'size-[34px]',
    initials: 'text-[11.5px]',
    plus: 'size-3',
    crown: 'size-4 -top-2',
    crownIcon: 9,
  },
  36: {
    circle: 'size-9',
    initials: 'text-xs',
    plus: 'size-[13px]',
    crown: 'size-[18px] -top-[9px]',
    crownIcon: 10,
  },
  44: {
    circle: 'size-11',
    initials: 'text-sm',
    plus: 'size-4',
    crown: 'size-5 -top-2.5',
    crownIcon: 11,
  },
}

/** What the circle looks like in each state, beyond its size. */
const STATE_CLASSES: Record<AvatarState, string> = {
  online: 'ring-2 ring-mint',
  away: 'opacity-50 grayscale-[0.85] outline-2 outline-offset-2 outline-[#4a4c54] outline-dashed',
  open: 'bg-raised-2 text-ds-muted shadow-[inset_0_0_0_1.5px_#34353c] motion-safe:animate-wait-pulse',
  vacant: 'bg-[#2a2b31] shadow-[inset_0_0_0_1px_#3a3b42]',
  none: '',
}

/** `panel` (reference, Colour tokens), the ground of the Lobby's panels and most avatars. */
const PANEL_GROUND = '#0f1013'

interface AvatarProps {
  /** @default 44 */
  readonly size?: AvatarSize
  /** @default 'none' */
  readonly state?: AvatarState
  /** The player's id, which picks the initials colours. Open and vacant slots have none. */
  readonly playerId?: string
  readonly name?: string | null
  /** The player's Discord image. Initials show when it is missing or fails to load. */
  readonly image?: string | null
  /** The crown of the Squad's host. */
  readonly host?: boolean
  /**
   * Names the avatar when no text next to it does. Without it the avatar is decorative, because its
   * parent carries the player's name and presence.
   */
  readonly label?: string
  /** The colour of the ground under the avatar, which the host crown's ring blends into. */
  readonly surface?: string
}

/**
 * The Redesign v2 avatar (reference, Components): the player's Discord image or their initials on a
 * colour pair picked from their id, with the presence of a member or an open slot.
 */
export function Avatar({
  size = 44,
  state = 'none',
  playerId,
  name,
  image,
  host = false,
  label,
  surface = PANEL_GROUND,
}: AvatarProps) {
  const t = useTranslations('ds.avatar')
  const sizeStyle = SIZE_STYLES[size]
  const isSlot = state === 'open' || state === 'vacant'
  const colors = pickAvatarColors(playerId ?? name ?? '')

  return (
    <span className={cn('relative block shrink-0', sizeStyle.circle)}>
      {state === 'online' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-0.5 rounded-full border-2 border-mint opacity-0 motion-safe:animate-halo"
        />
      )}
      <span
        {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
        className={cn(
          'relative flex size-full items-center justify-center overflow-hidden rounded-full font-extrabold',
          sizeStyle.initials,
          STATE_CLASSES[state]
        )}
        style={isSlot ? undefined : { background: colors.background, color: colors.foreground }}
      >
        {state === 'open' && <Plus className={cn(sizeStyle.plus, '[stroke-width:2.6]')} />}
        {!isSlot && <AvatarFace name={name} image={image} size={size} />}
      </span>
      {host && (
        <span
          className={cn(
            'absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-amber text-[#2a1a00]',
            sizeStyle.crown
          )}
          style={{ boxShadow: `0 0 0 3px ${surface}` }}
        >
          <svg
            role="img"
            aria-label={t('host')}
            width={sizeStyle.crownIcon}
            height={sizeStyle.crownIcon}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z" />
          </svg>
        </span>
      )}
    </span>
  )
}

/**
 * The image while its URL loads, and the initials when the URL is missing or fails. A failed URL is
 * remembered by value, so a different URL gets its own try.
 */
function AvatarFace({
  name,
  image,
  size,
}: {
  readonly name: string | null | undefined
  readonly image: string | null | undefined
  readonly size: AvatarSize
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null)

  // The server HTML starts the image loading before React attaches `onError`. An image that already
  // failed by then never fires the event again, so the ref checks the image once it is attached.
  const checkAttachedImage = useCallback(
    (img: HTMLImageElement | null) => {
      if (image && img?.complete && img.naturalWidth === 0) setFailedImage(image)
    },
    [image]
  )

  if (image && image !== failedImage) {
    return (
      <Image
        ref={checkAttachedImage}
        src={image}
        alt=""
        width={size}
        height={size}
        className="size-full object-cover"
        onError={() => setFailedImage(image)}
      />
    )
  }

  return initialsOf(name)
}

/** Two letters for a name of several words (first and last initial), the first two for one word. */
function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const first = Array.from(words[0] ?? '')
  const last = Array.from(words.at(-1) ?? '')
  const letters = words.length > 1 ? [first[0], last[0]] : first.slice(0, 2)
  return letters.join('').toUpperCase()
}

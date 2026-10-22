'use client'

import { useCallback, useState } from 'react'
import Image from 'next/image'

interface UserAvatarProps {
  readonly name?: string | null
  readonly image?: string | null
}

/** The rendered size in pixels, which matches the `size-7` class. */
const AVATAR_SIZE = 28

/**
 * The player's avatar. It shows the image while the URL loads, and the player's initial when the URL
 * is missing or fails. A failed URL is remembered by value, so a different URL gets its own try.
 */
export function UserAvatar({ name, image }: UserAvatarProps) {
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
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        className="size-7 rounded-full ring-1 ring-border"
        onError={() => setFailedImage(image)}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-7 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent"
    >
      {initialOf(name)}
    </span>
  )
}

function initialOf(name: string | null | undefined): string {
  return (name ?? '').trim().charAt(0).toUpperCase()
}

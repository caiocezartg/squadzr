'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { useReducedMotion } from '@/hooks/use-reduced-motion'

const GIF_SRC = '/help/voice-call-invite.gif'
const POSTER_SRC = '/help/voice-call-invite.png'
const MEDIA_WIDTH = 480
const MEDIA_HEIGHT = 414

/**
 * The recording of the clicks: a looping GIF, or its final frame with a "play animation" button under
 * reduced motion. A plain `<img>`, because the image optimizer would flatten the GIF into one frame.
 * The recording is of Discord's own dark UI, so a `line` ring sets it apart from the panel.
 */
export function VoiceCallHelpMedia() {
  const t = useTranslations('ds.createSquad.voiceCallHelp')
  const reduced = useReducedMotion()
  const [played, setPlayed] = useState(false)
  const still = reduced && !played

  return (
    <div className="flex flex-col items-start gap-2.5">
      <img
        src={still ? POSTER_SRC : GIF_SRC}
        width={MEDIA_WIDTH}
        height={MEDIA_HEIGHT}
        alt={t('mediaAlt')}
        className="block h-auto w-full bg-[#0c0d10] shadow-[0_0_0_1px_var(--color-line)]"
      />
      {still && (
        <Button variant="secondary" size="sm" icon={<Play />} onClick={() => setPlayed(true)}>
          {t('playAnimation')}
        </Button>
      )}
    </div>
  )
}

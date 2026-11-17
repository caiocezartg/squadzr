'use client'

import type { ReactNode } from 'react'
import { Info, Smartphone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Dialog } from '@/components/ds/dialog'
import { VoiceCallHelpMedia } from './voice-call-help-media'

export interface VoiceCallHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STEP_KEYS = ['step1', 'step2', 'step3'] as const

/**
 * How to copy an invite that points to a voice call: the recording, three numbered steps, the mobile
 * hint and the vanity-link note. Rendered inside the create dialog's tree, so Base UI treats it as a
 * child dialog: Escape and its close button dismiss only this one, and the form keeps its state. The
 * panel is as wide as the recording plus its padding, so the GIF is shown at its own size.
 */
export function VoiceCallHelpDialog({ open, onOpenChange }: VoiceCallHelpDialogProps) {
  const t = useTranslations('ds.createSquad.voiceCallHelp')

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('title')} className="max-w-132">
      <div className="flex flex-col gap-5 px-6 pt-5 pb-6">
        <VoiceCallHelpMedia />
        <ol role="list" aria-label={t('stepsLabel')} className="flex list-none flex-col gap-3">
          {STEP_KEYS.map((key, index) => (
            <li key={key} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-baseline">
              <span
                aria-hidden
                className="font-mono text-mint text-[12.5px] font-bold tabular-nums"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-text-2 text-sm leading-normal">{t(key)}</span>
            </li>
          ))}
        </ol>
        <div className="border-line flex flex-col gap-2 border-t pt-4">
          <HelpNote icon={<Smartphone />}>{t('mobileHint')}</HelpNote>
          <HelpNote icon={<Info />}>{t('vanityNote')}</HelpNote>
        </div>
      </div>
    </Dialog>
  )
}

/** A muted side note with a leading icon, in the tone of the Discord step's lock hint. */
function HelpNote({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="text-text-3 flex gap-2 text-[12.5px] leading-normal">
      <span
        aria-hidden
        className="text-muted mt-0.5 inline-flex shrink-0 [&_svg]:size-3.5 [&_svg]:stroke-[2.4]"
      >
        {icon}
      </span>
      {children}
    </p>
  )
}

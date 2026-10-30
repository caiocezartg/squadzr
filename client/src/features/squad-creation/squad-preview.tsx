'use client'

import { useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { SquadCard } from '@/features/squad-list'
import { useSession } from '@/hooks/use-session'
import type { Game } from '@/types'
import type { FormInput, FormValues } from './create-squad-form'
import { defaultPlayers } from './create-squad-form'
import { previewSquad } from './preview-squad'

/** The Squad card as others will see it, built live from the form and the viewer. */
export function SquadPreview({ game }: { game: Game }) {
  const t = useTranslations('ds.createSquad')
  const viewer = useSession()?.user
  const { control } = useFormContext<FormInput, unknown, FormValues>()
  const [name, maxPlayers, tags, language] = useWatch({
    control,
    name: ['name', 'maxPlayers', 'tags', 'language'],
  })
  const nameFallback = t('previewNameFallback')

  const squad = useMemo(
    () =>
      previewSquad({
        game,
        values: {
          name: name ?? '',
          maxPlayers: maxPlayers ?? defaultPlayers(game),
          tags,
          language,
        },
        viewer,
        nameFallback,
      }),
    [game, name, maxPlayers, tags, language, viewer, nameFallback]
  )

  return (
    <div className="flex flex-col gap-2.5">
      <span className="type-label text-ds-muted tracking-[0.12em]">{t('preview')}</span>
      <SquadCard squad={squad} preview />
    </div>
  )
}

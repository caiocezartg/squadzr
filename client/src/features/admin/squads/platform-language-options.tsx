'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { PLATFORMS, type Platform, type RoomLanguage } from '@squadzr/schemas'
import { ChoiceChips } from '@/components/ds/choice-chips'
import { PlatformIcon } from '@/components/ds/platform-icon'
import { Segmented } from '@/components/ds/segmented'

interface PlatformLanguageOptionsProps {
  /** The platform the URL keeps; empty is every platform. */
  readonly platform: Platform | ''
  /** The Squad language the URL keeps; empty is every language. */
  readonly language: RoomLanguage | ''
  readonly onPlatformChange: (platform: Platform | '') => void
  readonly onLanguageChange: (language: RoomLanguage | '') => void
}

/**
 * The filters panel's content, with the board's controls and labels: the language as a segmented
 * switch and the platform as chips. "All" stands for the empty value. Every change applies at once.
 */
export function PlatformLanguageOptions({
  platform,
  language,
  onPlatformChange,
  onLanguageChange,
}: PlatformLanguageOptionsProps) {
  const t = useTranslations('ds.board')
  const tPlatforms = useTranslations('platforms')
  const platformLabelId = useId()

  return (
    <div className="flex flex-col gap-5.5">
      <fieldset className="m-0 border-0 p-0">
        <legend className="type-label text-muted mb-2.5 p-0">{t('language')}</legend>
        <Segmented
          label={t('language')}
          fluid
          value={language || 'all'}
          onChange={(next) => onLanguageChange(next === 'all' ? '' : next)}
          options={[
            { value: 'all', label: t('languageAll') },
            { value: 'pt-br', label: 'PT-BR' },
            { value: 'en', label: 'EN-US' },
          ]}
        />
      </fieldset>

      <div>
        <span id={platformLabelId} className="type-label text-muted mb-2.5 block">
          {t('platform')}
        </span>
        <ChoiceChips
          labelledBy={platformLabelId}
          options={[
            { value: 'all', label: t('platformAll') },
            ...PLATFORMS.map((value) => ({
              value,
              label: tPlatforms(value),
              icon: <PlatformIcon platform={value} className="size-3" />,
            })),
          ]}
          value={platform || 'all'}
          onChange={(next) => onPlatformChange(next === 'all' ? '' : next)}
        />
      </div>
    </div>
  )
}

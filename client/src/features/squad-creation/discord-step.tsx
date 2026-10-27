'use client'

import { useFormContext } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import type { FormInput, FormValues } from './create-squad-form'
import { FormField } from './form-field'

/** Step 3: today's Discord invite field. */
export function DiscordStep() {
  const t = useTranslations()
  const {
    register,
    formState: { errors },
  } = useFormContext<FormInput, unknown, FormValues>()

  return (
    <FormField
      htmlFor="modal-discordLink"
      label={t('squads.createModal.discordLink')}
      hint={t('squads.createModal.discordLinkHelper')}
      error={
        errors.discordLink
          ? errors.discordLink.type === 'custom'
            ? t('squads.createModal.discordLinkNotValid')
            : t('squads.createModal.discordLinkInvalid')
          : undefined
      }
    >
      <input
        id="modal-discordLink"
        type="url"
        className={errors.discordLink ? 'input-field-error' : 'input-field'}
        placeholder="https://discord.gg/..."
        {...register('discordLink')}
      />
    </FormField>
  )
}

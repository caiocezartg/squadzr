'use client'

import { useTranslations } from 'next-intl'
import type { CatalogImportRunDto, ManualCatalogImportAvailability } from '@squadzr/schemas'
import { RunStatusPill, useInstantLabel } from './run-parts'

interface RunImportLockProps {
  /** Referenced by the disabled button's `aria-describedby`. */
  readonly id: string
  readonly manualRun: ManualCatalogImportAvailability
  readonly activeRun: CatalogImportRunDto | null
}

/**
 * Why Run import is disabled: a run holding the slot (queued or running, with its status pill) comes
 * first; otherwise the moment the 24 h manual window ends. Renders nothing while the button is enabled.
 */
export function RunImportLock({ id, manualRun, activeRun }: RunImportLockProps) {
  const t = useTranslations('admin.catalog.runImport')
  const instant = useInstantLabel()
  const className =
    'text-muted flex flex-wrap items-center gap-2 text-[12.5px] font-medium sm:justify-end sm:text-right'

  if (activeRun !== null) {
    const status = activeRun.status === 'requested' ? 'requested' : 'running'
    return (
      <p id={id} className={className}>
        <RunStatusPill status={activeRun.status} />
        <span>{t(`active.${status}`)}</span>
      </p>
    )
  }
  if (!manualRun.available) {
    return (
      <p id={id} className={className}>
        {t('availableAt', { at: instant(manualRun.availableAt) })}
      </p>
    )
  }
  return null
}

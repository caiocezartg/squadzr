'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { CatalogImportRunDto, ManualCatalogImportAvailability } from '@squadzr/schemas'
import { Button } from '@/components/ds/button'
import { RunImportDialog } from './run-import-dialog'
import { RunImportLock } from './run-import-lock'

interface RunImportPanelProps {
  readonly manualRun: ManualCatalogImportAvailability
  readonly activeRun: CatalogImportRunDto | null
}

/**
 * The manual run of the Catalog Import (reference, Admin panel, Catalog): what it does and a Run
 * import button, enabled only outside the 24 h manual window and while no run holds the slot. The
 * button asks for confirmation first; the line under it says why it is disabled.
 */
export function RunImportPanel({ manualRun, activeRun }: RunImportPanelProps) {
  const t = useTranslations('admin.catalog.runImport')
  const titleId = useId()
  const lockId = useId()
  const [confirming, setConfirming] = useState(false)
  const enabled = manualRun.available && activeRun === null

  return (
    <section
      aria-labelledby={titleId}
      className="bg-panel grid gap-4.5 p-5 shadow-[inset_0_0_0_1px_var(--color-line)] sm:grid-cols-[1fr_auto] sm:items-center"
    >
      <div className="min-w-0">
        <p className="type-label text-muted">{t('caption')}</p>
        <h2 id={titleId} className="font-display mt-1.5 text-2xl leading-none font-black uppercase">
          {t('title')}
        </h2>
        <p className="text-muted mt-2.5 max-w-130 text-[12.5px] leading-normal font-medium">
          {t('hint')}
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button
          disabled={!enabled}
          aria-describedby={enabled ? undefined : lockId}
          onClick={() => setConfirming(true)}
        >
          {t('action')}
        </Button>
        <RunImportLock id={lockId} manualRun={manualRun} activeRun={activeRun} />
      </div>
      <RunImportDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onRequested={() => setConfirming(false)}
      />
    </section>
  )
}

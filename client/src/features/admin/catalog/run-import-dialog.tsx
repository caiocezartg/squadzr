'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { Dialog } from '@/components/ds/dialog'
import { getUserFriendlyError } from '@/lib/error-messages'
import { useRequestCatalogImportRun } from './use-catalog-import-runs'

interface RunImportDialogProps {
  readonly open: boolean
  readonly onCancel: () => void
  /** The run is queued: the dialog goes and the panel follows the run. */
  readonly onRequested: () => void
}

/**
 * Asks before requesting a manual Catalog Import: nothing is sent until Run import. A refused request
 * keeps the dialog open with the reason, translated.
 */
export function RunImportDialog({ open, onCancel, onRequested }: RunImportDialogProps) {
  const t = useTranslations('admin.catalog.runImport.dialog')
  const tAll = useTranslations()
  const request = useRequestCatalogImportRun()
  const pending = request.isPending

  const cancel = () => {
    if (pending) return
    request.reset()
    onCancel()
  }

  const confirm = async () => {
    if (pending) return
    try {
      await request.mutateAsync()
      request.reset()
      onRequested()
    } catch {
      // The refusal is shown below from the mutation's error.
    }
  }

  return (
    <Dialog
      title={t('title')}
      open={open}
      onOpenChange={(next) => {
        if (!next) cancel()
      }}
      className="max-w-120"
    >
      <p className="type-body text-text-3 px-6 pt-3">{t('body')}</p>
      <div aria-live="polite" className="px-6">
        {request.isError && (
          <p role="alert" className="text-danger pt-3 text-[13px] font-semibold">
            {getUserFriendlyError(request.error, tAll)}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 px-6 pt-6 pb-6">
        <Button type="button" variant="ghost" onClick={cancel} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button type="button" onClick={() => void confirm()} disabled={pending}>
          {pending ? t('confirming') : t('confirm')}
        </Button>
      </div>
    </Dialog>
  )
}

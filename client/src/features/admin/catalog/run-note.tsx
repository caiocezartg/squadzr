'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import type { CatalogImportRunDto } from '@squadzr/schemas'
import { cn } from '@/lib/utils'

/**
 * Why the run ended the way it did, or that it has not ended: the error message of a safety stop or a
 * failure as the import wrote it, an explanation for an interrupted run (it stopped answering, as
 * after a deploy), and a note for a queued or running one. A succeeded run has none.
 */
export function RunNote({ run }: { readonly run: CatalogImportRunDto }) {
  const t = useTranslations('admin.catalog.panel')
  const titleId = useId()

  switch (run.status) {
    case 'safety_stop':
    case 'failed':
      return (
        <section aria-labelledby={titleId} className="flex flex-col gap-2">
          <h3 id={titleId} className="type-label text-text-3">
            {t('error')}
          </h3>
          <pre
            className={cn(
              'scrollbar-thin bg-raised max-h-60 overflow-auto p-3 font-mono text-[12.5px] leading-relaxed break-words whitespace-pre-wrap',
              run.status === 'failed' ? 'text-danger' : 'text-amber'
            )}
          >
            {run.errorMessage ?? t('noErrorMessage')}
          </pre>
        </section>
      )
    case 'interrupted':
      return <Note>{t('interrupted')}</Note>
    case 'requested':
    case 'running':
      return <Note>{t('pending')}</Note>
    default:
      return null
  }
}

function Note({ children }: { readonly children: string }) {
  return (
    <p className="bg-raised text-text-3 p-3 text-[13px] leading-relaxed font-medium">{children}</p>
  )
}

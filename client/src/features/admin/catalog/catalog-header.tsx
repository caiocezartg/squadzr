'use client'

import { useTranslations } from 'next-intl'
import { AdminPageHeader } from '../shell/admin-page-header'
import { CatalogTabs, type CatalogTab } from './catalog-tabs'

/** The Catalog page's header, the same on both tabs, with the tabs under it. */
export function CatalogHeader({ current }: { readonly current: CatalogTab }) {
  const t = useTranslations('admin.catalog.header')

  return (
    <>
      <AdminPageHeader title={t('title')} description={t('description')} />
      <CatalogTabs current={current} />
    </>
  )
}

import { useTranslations } from 'next-intl'
import { AdminPageHeader } from '../shell/admin-page-header'
import { AdminPlaceholder } from '../shell/admin-placeholder'

/** The admin Squads page. For now it holds its header and a note; its content comes next. */
export function AdminSquadsPage() {
  const t = useTranslations('admin.squads')

  return (
    <>
      <AdminPageHeader title={t('title')} description={t('description')} />
      <AdminPlaceholder />
    </>
  )
}

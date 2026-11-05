'use client'

import { useTranslations } from 'next-intl'
import { ADMIN_USER_SEARCH_MAX_LENGTH, PAGE_SIZE, type AdminUsersResponse } from '@squadzr/schemas'
import { Pagination } from '@/components/ds/pagination'
import { SearchField } from '@/components/ds/search-field'
import { cn } from '@/lib/utils'
import { AdminPageHeader } from '../shell/admin-page-header'
import { useUsersSearch } from './use-users-search'
import { useAdminUsers } from './users-query'
import { UsersRowList } from './users-row-list'
import { UsersEmpty, UsersLoadError, UsersSkeleton } from './users-states'
import { UsersTable } from './users-table'

/**
 * The Users page: everyone, searchable by name, Discord id or user id, 20 per page, the search and page
 * held in the URL as `?q=&page=`. Results the server or an earlier visit read render at once; the
 * skeleton is only for a search and page the cache never held. A new search or page keeps the previous
 * results on screen until its own land.
 */
export function AdminUsersPage() {
  const t = useTranslations('admin.users')
  const { search, page, draft, setDraft, clear, goTo } = useUsersSearch()
  const query = useAdminUsers(search, page)

  return (
    <>
      <AdminPageHeader title={t('title')} description={t('description')} />
      <SearchField
        label={t('search.label')}
        placeholder={t('search.placeholder')}
        value={draft}
        onChange={setDraft}
        onClear={clear}
        maxLength={ADMIN_USER_SEARCH_MAX_LENGTH}
        className="sm:max-w-md"
      />
      {query.data ? (
        <div
          aria-busy={query.isPlaceholderData}
          className={cn(query.isPlaceholderData && 'opacity-70')}
        >
          <UsersResults
            data={query.data}
            search={search}
            page={page}
            onPageChange={goTo}
            onClearSearch={clear}
          />
        </div>
      ) : query.isError ? (
        <UsersLoadError message={t('loadError')} onRetry={() => void query.refetch()} />
      ) : (
        <UsersSkeleton />
      )}
    </>
  )
}

interface UsersResultsProps {
  readonly data: AdminUsersResponse
  /** The search and page the URL asks for, which `data` may still be the previous one of. */
  readonly search: string
  readonly page: number
  readonly onPageChange: (page: number) => void
  readonly onClearSearch: () => void
}

function UsersResults({ data, search, page, onPageChange, onClearSearch }: UsersResultsProps) {
  const t = useTranslations('admin.users')
  const pageCount = Math.ceil(data.total / PAGE_SIZE)

  if (data.total === 0 && search) {
    return (
      <UsersEmpty
        title={t('noMatch.title', { search })}
        description={t('noMatch.description')}
        action={{ label: t('noMatch.action'), onClick: onClearSearch }}
      />
    )
  }

  if (data.total === 0) {
    return <UsersEmpty title={t('empty.title')} description={t('empty.description')} />
  }

  // A page past the end answers no people with the real total: it offers the first page instead.
  if (data.items.length === 0) {
    return (
      <UsersEmpty
        title={t('pastEnd.title')}
        action={{ label: t('pastEnd.action'), onClick: () => onPageChange(1) }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Both layouts are in the HTML, so the server render fits every width; CSS shows one. */}
      <div className="hidden sm:block">
        <UsersTable users={data.items} />
      </div>
      <div className="sm:hidden">
        <UsersRowList users={data.items} />
      </div>
      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        className="flex-wrap justify-end"
      />
    </div>
  )
}

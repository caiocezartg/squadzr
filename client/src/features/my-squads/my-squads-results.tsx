import { Tabs } from '@base-ui-components/react'
import { useTranslations } from 'next-intl'
import { useSuspenseGames, useGamesMap } from '@/features/games'
import { CreateSquadDialog } from '@/features/squad-creation'
import { querySquadList, SquadGrid, type SquadListQuery } from '@/features/squad-list'
import { useAppNavigation } from '@/lib/navigation'
import { lobbyHref } from '@/lib/squad-links'
import { useMySquads } from './use-my-squads-data'

export interface MySquadsResultsProps {
  /** The list's update count when the page mounted (see `useMySquadsBaseline`). */
  readonly baseline: number
  /** The URL's search, resolved: it filters and sorts both lists. */
  readonly query: SquadListQuery
  /** Whether the search, language or tag narrows the list; it picks the empty state's wording. */
  readonly hasActiveFilters: boolean
  /** The create dialog is opened from the page header, so its state comes from the page. */
  readonly createOpen: boolean
  readonly onCreateOpenChange: (open: boolean) => void
}

/**
 * The squads My Squads lists: the hosted and joined tabs, their grids and the create dialog. It
 * reads the lists and the games, so it suspends until both are cached, and the page shows its title
 * and filters in the meantime. Both panels stay mounted, so the server HTML carries the hosted and
 * the joined Squads even though only one tab is selected.
 */
export function MySquadsResults({
  baseline,
  query,
  hasActiveFilters,
  createOpen,
  onCreateOpenChange,
}: MySquadsResultsProps) {
  const t = useTranslations()
  const navigateApp = useAppNavigation()
  const { hosted, joined, refetch } = useMySquads(baseline)
  const games = useSuspenseGames()
  const gamesMap = useGamesMap(games)

  const hostedSquads = querySquadList(hosted, gamesMap, query).matching
  const joinedSquads = querySquadList(joined, gamesMap, query).matching

  return (
    <>
      <Tabs.Root defaultValue="created" className="mt-6">
        {/* Tab list */}
        <Tabs.List className="flex gap-1 border-b border-white/10 mb-6">
          <Tabs.Tab
            value="created"
            className="px-4 py-2.5 text-sm font-medium text-white/50 transition-colors cursor-pointer data-selected:text-accent data-selected:border-b-2 data-selected:border-accent hover:text-white/80 -mb-px outline-hidden"
          >
            {t('mySquads.tabCreated', { count: hosted.length })}
          </Tabs.Tab>
          <Tabs.Tab
            value="joined"
            className="px-4 py-2.5 text-sm font-medium text-white/50 transition-colors cursor-pointer data-selected:text-accent data-selected:border-b-2 data-selected:border-accent hover:text-white/80 -mb-px outline-hidden"
          >
            {t('mySquads.tabJoined', { count: joined.length })}
          </Tabs.Tab>
        </Tabs.List>

        {/* Created panel */}
        <Tabs.Panel value="created" keepMounted>
          {hostedSquads.length === 0 ? (
            <p className="text-white/40 text-sm py-6">
              {hasActiveFilters ? t('mySquads.noSquadsFiltered') : t('mySquads.noSquadsYet')}
            </p>
          ) : (
            <SquadGrid
              squads={hostedSquads}
              games={gamesMap}
              onSelect={(squad) => navigateApp(lobbyHref(squad.code))}
            />
          )}
        </Tabs.Panel>

        {/* Joined panel */}
        <Tabs.Panel value="joined" keepMounted>
          {joinedSquads.length === 0 ? (
            <p className="text-white/40 text-sm py-6">
              {hasActiveFilters ? t('mySquads.noSquadsFiltered') : t('mySquads.noSquadsYet')}
            </p>
          ) : (
            <SquadGrid
              squads={joinedSquads}
              games={gamesMap}
              onSelect={(squad) => navigateApp(lobbyHref(squad.code))}
            />
          )}
        </Tabs.Panel>
      </Tabs.Root>

      {/* The one create squad dialog, mounted only while it is open. */}
      {createOpen && (
        <CreateSquadDialog
          games={games}
          onClose={() => onCreateOpenChange(false)}
          onCreated={() => {
            void refetch()
          }}
        />
      )}
    </>
  )
}

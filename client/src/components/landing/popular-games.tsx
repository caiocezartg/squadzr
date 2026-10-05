import { useRef } from 'react'
import * as motion from 'motion/react-client'
import type { Game } from '@/types'
import { useGames } from '@/features/games'
import { useTranslation } from 'react-i18next'

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = result[i] as T
    result[i] = result[j] as T
    result[j] = temp
  }
  return result
}

export function PopularGames() {
  const { t } = useTranslation()
  const { games, loading: isLoading } = useGames()

  const prevGamesRef = useRef<Game[] | undefined>(undefined)
  const shuffledRef = useRef<Game[]>([])

  if (games !== prevGamesRef.current) {
    prevGamesRef.current = games
    shuffledRef.current = fisherYatesShuffle(games).slice(0, 8)
  }

  const shuffledGames = shuffledRef.current

  return (
    <section className="relative py-24 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <span className="section-label">{t('popularGames.label')}</span>
          <h2 className="font-heading text-3xl font-bold sm:text-4xl">{t('popularGames.title')}</h2>
          <p className="mt-4 text-muted max-w-lg mx-auto">{t('popularGames.subtitle')}</p>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-surface animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {shuffledGames.map((game, i) => (
              <motion.div
                key={game.id}
                className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border bg-surface cursor-default"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <img
                  src={game.coverUrl}
                  alt={game.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500"
                  loading="lazy"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                {/* Game info */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="font-heading text-sm font-bold truncate">{game.name}</h3>
                  <p className="text-xs text-muted mt-0.5">
                    {t('popularGames.playerRange', { min: game.minPlayers, max: game.maxPlayers })}
                  </p>
                </div>

                {/* Hover glow */}
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5 group-hover:ring-accent/30 transition-all duration-300" />
              </motion.div>
            ))}
          </div>
        )}

        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <p className="mt-8 text-muted text-lg max-w-lg mx-auto">{t('popularGames.moreGames')}</p>
        </motion.div>
      </div>
    </section>
  )
}

/**
 * The message files: one namespace each, with the same keys, and the ICU syntax that replaces the
 * i18next forms renders the text the app showed before. The English file is also the type of
 * `useTranslations` (see ./next-intl.d.ts), so a key only English defines is caught by the type.
 */

import { describe, expect, it } from 'vitest'
import { createTranslator } from 'next-intl'
import en from '@/locales/en.json'
import ptBR from '@/locales/pt-BR.json'

function messagePaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix]
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => messagePaths(item, `${prefix}.${index}`))
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      messagePaths(child, prefix === '' ? key : `${prefix}.${key}`)
    )
  }
  return []
}

interface FaqMessages {
  readonly landing: { readonly faq: { readonly items: readonly { id: string; answer: string }[] } }
}

function faqAnswer(messages: FaqMessages, id: string): string {
  return messages.landing.faq.items.find((item) => item.id === id)?.answer ?? ''
}

const t = createTranslator({ locale: 'en', messages: en })
const tPtBR = createTranslator({ locale: 'pt-BR', messages: ptBR })

describe('message files', () => {
  it('define the same message paths in English and Portuguese', () => {
    expect(messagePaths(ptBR).sort()).toEqual(messagePaths(en).sort())
  })
})

describe('ICU messages', () => {
  it('chooses the plural form by count in each locale', () => {
    expect(t('ds.board.openCount', { count: 1 })).toBe('1 open squad')
    expect(t('ds.board.openCount', { count: 3 })).toBe('3 open squads')
    expect(tPtBR('ds.board.openCount', { count: 1 })).toBe('1 squad aberto')
    expect(tPtBR('ds.board.openCount', { count: 2 })).toBe('2 squads abertos')
  })

  it('prints a large count without grouping separators, as the raw value did', () => {
    expect(t('ds.board.openCount', { count: 1000 })).toBe('1000 open squads')
  })

  it('fills single-brace placeholders', () => {
    expect(t('landing.games.tower', { name: 'Dota 2', genre: 'MOBA' })).toBe(
      'Dota 2, MOBA: see its squads'
    )
    expect(tPtBR('ds.tag.remove', { label: '#ranked' })).toBe('Remover #ranked')
    expect(tPtBR('timeAgo.minutesAgo', { count: 5 })).toBe('há 5min')
  })

  it('labels the player stepper of the create wizard in both languages', () => {
    expect(t('ds.createSquad.playersFewer')).toBe('One fewer player')
    expect(t('ds.createSquad.playersMore')).toBe('One more player')
    expect(tPtBR('ds.createSquad.playersFewer')).toBe('Menos um jogador')
    expect(tPtBR('ds.createSquad.playersMore')).toBe('Mais um jogador')
  })

  it('announces the game search results in both languages', () => {
    expect(t('squads.createModal.gamesFound', { count: 1 })).toBe('1 game found')
    expect(t('squads.createModal.gamesFound', { count: 3 })).toBe('3 games found')
    expect(tPtBR('squads.createModal.gamesFound', { count: 1 })).toBe('1 jogo encontrado')
    expect(tPtBR('squads.createModal.gamesFound', { count: 3 })).toBe('3 jogos encontrados')
    expect(t('squads.createModal.noGamesFound')).toBe('No games found. Try another name.')
    expect(tPtBR('squads.createModal.noGamesFound')).toBe(
      'Nenhum jogo encontrado. Tente outro nome.'
    )
  })

  it('keeps the text around rich tags', () => {
    expect(t.rich('landing.cta.title', { em: (chunks) => chunks })).toBe(
      "There's a slot waiting for you."
    )
    expect(tPtBR.rich('landing.cta.title', { em: (chunks) => `[${chunks}]` })).toBe(
      'Tem vaga [te esperando.]'
    )
    expect(tPtBR.rich('landing.cta.subtitle', { line: (chunks) => `[${chunks}]` })).toBe(
      'Entre com o Discord e ache o seu squad agora [ou abra o seu e deixa o time vir até você.]'
    )
  })

  it('reads the FAQ items and the how-it-works steps as raw arrays', () => {
    const faqItems = t.raw('landing.faq.items') as Array<{ question: string; answer: string }>
    const steps = t.raw('howItWorks.steps') as Array<{ title: string; description: string }>

    expect(faqItems).toHaveLength(8)
    expect(faqItems[0]?.question).toBe('Is Squadzr free?')
    expect(steps).toHaveLength(3)
    expect(steps[2]?.title).toBe('Squad Up & Play')
  })

  it('lets the player count run from 2 to 40 in both languages', () => {
    expect(faqAnswer(en, 'player-count')).toContain('from 2 to 40')
    expect(faqAnswer(ptBR, 'player-count')).toContain('de 2 a 40')
  })

  it('does not promise a fixed number of supported games in either language', () => {
    const supportedGamesAnswer = (messages: FaqMessages) => faqAnswer(messages, 'supported-games')

    expect(supportedGamesAnswer(en)).not.toMatch(/\d/)
    expect(supportedGamesAnswer(ptBR)).not.toMatch(/\d/)
    expect(supportedGamesAnswer(en)).toContain('catalog')
    expect(supportedGamesAnswer(ptBR)).toContain('catálogo')
    expect(t('landing.games.subtitle')).not.toMatch(/\d/)
    expect(tPtBR('landing.games.subtitle')).not.toMatch(/\d/)
  })

  it('credits IGDB in both languages', () => {
    expect(t('landing.footer.gameDataByIgdb')).toBe('game data by IGDB')
    expect(tPtBR('landing.footer.gameDataByIgdb')).toBe('dados de jogos por IGDB')
  })

  it('keeps apostrophes in plain text', () => {
    expect(t('notFound.description')).toContain("you've wandered off the map")
  })
})

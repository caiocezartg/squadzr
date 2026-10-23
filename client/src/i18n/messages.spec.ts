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

const t = createTranslator({ locale: 'en', messages: en })
const tPtBR = createTranslator({ locale: 'pt-BR', messages: ptBR })

describe('message files', () => {
  it('define the same message paths in English and Portuguese', () => {
    expect(messagePaths(ptBR).sort()).toEqual(messagePaths(en).sort())
  })
})

describe('ICU messages', () => {
  it('chooses the plural form by count in each locale', () => {
    expect(t('squads.page.subtitle', { count: 1 })).toBe('1 squad available')
    expect(t('squads.page.subtitle', { count: 3 })).toBe('3 squads available')
    expect(tPtBR('squads.page.subtitle', { count: 1 })).toBe('1 squad disponível')
    expect(tPtBR('squads.page.subtitle', { count: 2 })).toBe('2 squads disponíveis')
  })

  it('prints a large count without grouping separators, as the raw value did', () => {
    expect(t('squads.page.subtitle', { count: 1000 })).toBe('1000 squads available')
  })

  it('fills single-brace placeholders', () => {
    expect(t('popularGames.playerRange', { min: 5, max: 10 })).toBe('5-10 players')
    expect(tPtBR('squads.createModal.removeTag', { tag: 'ranked' })).toBe('Remover tag ranked')
    expect(tPtBR('timeAgo.minutesAgo', { count: 5 })).toBe('há 5min')
  })

  it('states the 40-player Squad limit in both languages', () => {
    expect(t('squads.createModal.maxPlayersTooMany')).toBe('Max 40 players')
    expect(tPtBR('squads.createModal.maxPlayersTooMany')).toBe('Máximo de 40 jogadores')
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
    expect(t.rich('hero.subtitle', { bold: (chunks) => chunks })).toBe(
      'Create or join squads, fill your squad, and get a Discord invite the second your team is ready.'
    )
    expect(tPtBR.rich('cta.title', { accent: (chunks) => `[${chunks}]` })).toBe(
      'Pronto para encontrar seu [squad]?'
    )
  })

  it('reads the FAQ items and the how-it-works steps as raw arrays', () => {
    const faqItems = t.raw('faq.items') as Array<{ question: string; answer: string }>
    const steps = t.raw('howItWorks.steps') as Array<{ title: string; description: string }>

    expect(faqItems).toHaveLength(8)
    expect(faqItems[0]?.question).toBe('Is Squadzr free?')
    expect(steps).toHaveLength(3)
    expect(steps[2]?.title).toBe('Squad Up & Play')
  })

  it('keeps apostrophes in plain text', () => {
    expect(t('notFound.description')).toContain("you've wandered off the map")
  })
})

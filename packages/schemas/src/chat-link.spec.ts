import { describe, expect, it } from 'vitest'
import { chatMessageBodySchema } from './chat'
import { containsLink } from './chat-link'

describe('containsLink', () => {
  it.each([
    'entra aí https://discord.gg/abc123',
    'http://example.com',
    'HTTPS://EXAMPLE.COM',
    'discord://invite/abc',
    'ftp://files.example.org',
    'www.example.com',
    'WWW.Example.org',
    'discord.gg/abc123',
    'Discord.GG/abc123',
    'discord.com/invite/abc123',
    'entra no discord.gg',
    'bit.ly/xyz',
    'site.com.br',
    'meusite.com.br/pagina',
    'twitch.tv/streamer',
    'example.app.',
    '(discord.gg/abc)',
    'link: steamcommunity.com',
    'loja.xyz/oferta',
    'olá.com',
    'discord . com / server / alguma-coisa',
    'discord .gg/abc',
    'discord. gg/abc',
    'discord. gg / abc',
    'discord(.)gg/abc',
    'discord[.]com',
    'discord ( . ) gg',
    'discord．gg/abc',
    'discord . gg',
  ])('finds the link in %j', (text) => {
    expect(containsLink(text)).toBe(true)
  })

  it.each([
    'oi time',
    'bora jogar às 20:30?',
    'versão 1.5.2 do patch',
    'gg wp',
    'gg.wp',
    'e.g. isso',
    'ana@gmail.com',
    'manda no ana.souza@gmail.com',
    'fim de frase.Começo de outra',
    'joguei bem.Pro time',
    'tô no top.aí',
    'reticências...com calma',
    'km/h',
    '3/5 vagas',
    '3 / 5 vagas',
    'Foi bom. Com certeza',
    'Ganhamos. Me chama amanhã',
    'GG. Bora de novo',
    'espera . . . com calma',
    'top 1. eu sou o melhor',
    'ok (.) beleza',
    'mid/top / bot',
  ])('finds no link in %j', (text) => {
    expect(containsLink(text)).toBe(false)
  })
})

describe('chatMessageBodySchema and links', () => {
  it('refuses a body with a link', () => {
    const result = chatMessageBodySchema.safeParse('entra aí discord.gg/abc123')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Links are not allowed in the chat')
  })

  it('accepts a body without a link', () => {
    expect(chatMessageBodySchema.parse('bora jogar')).toBe('bora jogar')
  })
})

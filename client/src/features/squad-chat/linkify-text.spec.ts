import { describe, expect, it } from 'vitest'
import { linkifyText, type LinkifySegment } from './linkify-text'

const text = (value: string): LinkifySegment => ({ type: 'text', text: value })
const link = (value: string, href: string): LinkifySegment => ({
  type: 'link',
  text: value,
  href,
})

describe('linkifyText', () => {
  it('returns plain text as one segment', () => {
    expect(linkifyText('hello there')).toEqual([text('hello there')])
  })

  it('returns nothing for an empty string', () => {
    expect(linkifyText('')).toEqual([])
  })

  it.each([
    ['http://example.com', 'http://example.com/'],
    ['https://example.com/a?b=1#c', 'https://example.com/a?b=1#c'],
    ['www.example.com', 'https://www.example.com/'],
    ['www.example.com/path', 'https://www.example.com/path'],
  ])('links %s', (url, href) => {
    expect(linkifyText(`go ${url} now`)).toEqual([text('go '), link(url, href), text(' now')])
  })

  it.each(['HTTPS://EXAMPLE.COM/Path', 'Http://example.com', 'WWW.Example.com'])(
    'matches the scheme case-insensitively in %s and keeps the visible text',
    (url) => {
      const [segment] = linkifyText(url)
      expect(segment).toMatchObject({ type: 'link', text: url })
    }
  )

  it('links several URLs in one message', () => {
    expect(linkifyText('a https://one.test b www.two.test c')).toEqual([
      text('a '),
      link('https://one.test', 'https://one.test/'),
      text(' b '),
      link('www.two.test', 'https://www.two.test/'),
      text(' c'),
    ])
  })

  it.each(['.', ',', '!', '?', ';', ':', '...', '?!'])(
    'leaves the trailing %s out of the link',
    (punctuation) => {
      expect(linkifyText(`see https://example.com/a${punctuation}`)).toEqual([
        text('see '),
        link('https://example.com/a', 'https://example.com/a'),
        text(punctuation),
      ])
    }
  )

  it('leaves quotes that wrap a link out of it', () => {
    expect(linkifyText('"https://example.com/a"')).toEqual([
      text('"'),
      link('https://example.com/a', 'https://example.com/a'),
      text('"'),
    ])
  })

  it('leaves an unbalanced closing parenthesis out of the link', () => {
    expect(linkifyText('(see https://example.com/a)')).toEqual([
      text('(see '),
      link('https://example.com/a', 'https://example.com/a'),
      text(')'),
    ])
  })

  it('keeps a balanced parenthesis that belongs to the URL', () => {
    expect(linkifyText('https://en.wikipedia.org/wiki/Squad_(game)')).toEqual([
      link(
        'https://en.wikipedia.org/wiki/Squad_(game)',
        'https://en.wikipedia.org/wiki/Squad_(game)'
      ),
    ])
  })

  it('handles a balanced parenthesis followed by punctuation and a closing one', () => {
    expect(linkifyText('(https://example.com/a_(b)).')).toEqual([
      text('('),
      link('https://example.com/a_(b)', 'https://example.com/a_(b)'),
      text(').'),
    ])
  })

  it('leaves an unbalanced square bracket out of the link', () => {
    expect(linkifyText('[https://example.com/a]')).toEqual([
      text('['),
      link('https://example.com/a', 'https://example.com/a'),
      text(']'),
    ])
  })

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com',
    'file:///etc/passwd',
    'mailto:a@b.test',
    'vbscript:msgbox(1)',
  ])('never links the protocol in %s', (value) => {
    expect(linkifyText(value)).toEqual([text(value)])
  })

  it('does not link a javascript: URL hidden behind a www. prefix', () => {
    const segments = linkifyText('www.example.com/javascript:alert(1)')
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({
      type: 'link',
      href: 'https://www.example.com/javascript:alert(1)',
    })
  })

  it.each(['http://', 'https://', 'www.', 'http:///only-a-path', 'https:// example.com'])(
    'does not link the incomplete %j',
    (value) => {
      expect(linkifyText(value).every((segment) => segment.type === 'text')).toBe(true)
    }
  )

  it('does not link a www. glued to a word', () => {
    expect(linkifyText('awww.example.com')).toEqual([text('awww.example.com')])
  })

  it('never produces HTML: markup stays plain text', () => {
    expect(linkifyText('<img src=x onerror=alert(1)>')).toEqual([
      text('<img src=x onerror=alert(1)>'),
    ])
  })

  it('keeps the original text intact when segments are joined back', () => {
    const input = 'a <b> https://x.test/a?b=1, (www.y.test/z) "q" end.'
    expect(
      linkifyText(input)
        .map((segment) => segment.text)
        .join('')
    ).toBe(input)
  })

  it('keeps line breaks in the text segments', () => {
    expect(linkifyText('one\nhttps://example.com\ntwo')).toEqual([
      text('one\n'),
      link('https://example.com', 'https://example.com/'),
      text('\ntwo'),
    ])
  })
})

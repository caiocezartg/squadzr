/**
 * `JSON.parse` keeps the last of two equal keys in one object, so a key defined twice (two branches
 * each adding their own `"ds"` block, merged by git without a conflict) silently drops the first
 * one's messages. This reads the message files as raw text, where the duplicate is still visible.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const LOCALES = ['en', 'pt-BR'] as const

/** The dotted path of every key that appears more than once in the same JSON object. */
function findDuplicateKeys(source: string): string[] {
  const duplicates: string[] = []
  let position = 0

  function skipWhitespace() {
    while (/\s/.test(source[position] ?? '')) position += 1
  }

  function readString(): string {
    const start = position
    position += 1
    while (source[position] !== '"') position += source[position] === '\\' ? 2 : 1
    position += 1
    return JSON.parse(source.slice(start, position)) as string
  }

  function readValue(valuePath: string) {
    skipWhitespace()
    const char = source[position]
    if (char === '{') return readObject(valuePath)
    if (char === '[') return readArray(valuePath)
    if (char === '"') {
      readString()
      return
    }
    while (!/[\s,}\]]/.test(source[position] ?? ',')) position += 1
  }

  function readObject(objectPath: string) {
    const seen = new Set<string>()
    position += 1
    skipWhitespace()
    while (source[position] !== '}') {
      const key = readString()
      const keyPath = objectPath === '' ? key : `${objectPath}.${key}`
      if (seen.has(key)) duplicates.push(keyPath)
      seen.add(key)
      skipWhitespace()
      position += 1
      readValue(keyPath)
      skipWhitespace()
      if (source[position] === ',') position += 1
      skipWhitespace()
    }
    position += 1
  }

  function readArray(arrayPath: string) {
    position += 1
    skipWhitespace()
    for (let index = 0; source[position] !== ']'; index += 1) {
      readValue(`${arrayPath}.${index}`)
      skipWhitespace()
      if (source[position] === ',') position += 1
      skipWhitespace()
    }
    position += 1
  }

  readValue('')
  return duplicates
}

describe('findDuplicateKeys', () => {
  it('reports a key repeated in the same object, at any depth', () => {
    expect(findDuplicateKeys('{"a":{"b":"x"},"a":{"c":"y"}}')).toEqual(['a'])
    expect(findDuplicateKeys('{"a":{"b":"x","b":"y"}}')).toEqual(['a.b'])
    expect(findDuplicateKeys('{"a":[{"b":1,"b":2}]}')).toEqual(['a.0.b'])
  })

  it('accepts the same key name in different objects', () => {
    expect(findDuplicateKeys('{"a":{"b":"x"},"c":{"b":"y"}}')).toEqual([])
  })
})

describe('message files', () => {
  it.each(LOCALES)('define every key once in %s.json', (locale) => {
    const source = readFileSync(path.join(__dirname, '..', 'locales', `${locale}.json`), 'utf8')

    expect(findDuplicateKeys(source)).toEqual([])
  })
})

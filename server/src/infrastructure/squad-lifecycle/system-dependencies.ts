import { randomInt, randomUUID } from 'node:crypto'
import type { Clock, Identifier } from '@domain/squad-lifecycle'

const codeCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}

export class SystemIdentifier implements Identifier {
  newId(): string {
    return randomUUID()
  }

  squadCode(): string {
    let code = ''
    for (let index = 0; index < 6; index += 1) {
      code += codeCharacters.charAt(randomInt(codeCharacters.length))
    }
    return code
  }
}

import type { Clock, Identifier } from '@domain/squad-lifecycle'

export class DeterministicClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current)
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds)
  }
}

export class DeterministicIdentifier implements Identifier {
  private sequence = 0

  newId(): string {
    this.sequence += 1
    return `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`
  }

  squadCode(): string {
    this.sequence += 1
    return this.sequence.toString(36).toUpperCase().padStart(6, '0')
  }
}

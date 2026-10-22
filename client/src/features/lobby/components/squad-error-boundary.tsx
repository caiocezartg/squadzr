import { Component, type ReactNode } from 'react'

interface SquadErrorBoundaryProps {
  /** A new value clears a failure, so a different Squad gets its own read. */
  readonly resetKey: string
  readonly fallback: ReactNode
  readonly children: ReactNode
}

interface SquadErrorBoundaryState {
  readonly failed: boolean
  readonly resetKey: string
}

/**
 * Shows `fallback` in place of the Lobby when its Squad read throws. The failure stays until the reset key
 * changes, so the Lobby keeps its realtime channel mounted across a switch to another Squad.
 */
export class SquadErrorBoundary extends Component<
  SquadErrorBoundaryProps,
  SquadErrorBoundaryState
> {
  state: SquadErrorBoundaryState = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromProps(
    props: SquadErrorBoundaryProps,
    state: SquadErrorBoundaryState
  ): Partial<SquadErrorBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey }
  }

  static getDerivedStateFromError(): Partial<SquadErrorBoundaryState> {
    return { failed: true }
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

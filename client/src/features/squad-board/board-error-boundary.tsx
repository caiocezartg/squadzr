import { Component, type ReactNode } from 'react'

interface BoardErrorBoundaryProps {
  readonly fallback: ReactNode
  readonly children: ReactNode
}

interface BoardErrorBoundaryState {
  readonly failed: boolean
}

/**
 * Shows `fallback` in place of a board section whose read failed, so the rest of the page keeps
 * rendering. A read that is still loading is not an error: its Suspense boundary shows the skeleton.
 * The boundary keeps the failure until it remounts: the board gives it a new `key` when the reader
 * tries again, after clearing the failed reads (see `useDiscardFailedBoardReads`).
 */
export class BoardErrorBoundary extends Component<
  BoardErrorBoundaryProps,
  BoardErrorBoundaryState
> {
  state: BoardErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): BoardErrorBoundaryState {
    return { failed: true }
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

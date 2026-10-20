import { Component, type ReactNode } from 'react'

interface MySquadsErrorBoundaryProps {
  readonly fallback: ReactNode
  readonly children: ReactNode
}

interface MySquadsErrorBoundaryState {
  readonly failed: boolean
}

/**
 * Shows `fallback` in place of the list when its read failed, so the title and the filters keep
 * rendering. A read that is still loading is not an error: its Suspense boundary shows the skeleton.
 * The boundary keeps the failure until it remounts: the page gives it a new `key` when the reader
 * tries again, after clearing the failed reads (see `useDiscardFailedMySquadsReads`).
 */
export class MySquadsErrorBoundary extends Component<
  MySquadsErrorBoundaryProps,
  MySquadsErrorBoundaryState
> {
  state: MySquadsErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): MySquadsErrorBoundaryState {
    return { failed: true }
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

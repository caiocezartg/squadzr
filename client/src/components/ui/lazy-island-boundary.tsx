import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface LazyIslandBoundaryProps {
  readonly children: ReactNode
  /** Shown when the island fails; non-essential islands default to nothing. */
  readonly fallback?: ReactNode
}

interface LazyIslandBoundaryState {
  readonly failed: boolean
}

/**
 * Error boundary for non-essential on-demand islands (toasts, notifications,
 * below-the-fold landing sections).
 *
 * A failed chunk import — unstable network, a deploy that replaced the hashed
 * file — would otherwise bubble to the router boundary and replace the whole
 * app with its default error screen. Here the island alone disappears (or
 * renders a static fallback) and the rest of the page and header keep working.
 */
export class LazyIslandBoundary extends Component<
  LazyIslandBoundaryProps,
  LazyIslandBoundaryState
> {
  state: LazyIslandBoundaryState = { failed: false }

  static getDerivedStateFromError(): LazyIslandBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // The island is optional: record the failure and keep the page alive.
    console.error('Lazy island failed to load:', error, errorInfo.componentStack)
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}

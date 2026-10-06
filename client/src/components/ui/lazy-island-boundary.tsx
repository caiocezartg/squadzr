import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface LazyIslandBoundaryProps {
  readonly children: ReactNode
  /** Shown when the island fails; non-essential islands default to nothing. */
  readonly fallback?: ReactNode
  /** Called once when the island fails, so the owner can surface the failure. */
  readonly onError?: (error: Error) => void
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
    // The island is optional: tell the owner (once per failure), record it and
    // keep the page alive.
    this.props.onError?.(error)
    console.error('Lazy island failed to load:', error, errorInfo.componentStack)
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}

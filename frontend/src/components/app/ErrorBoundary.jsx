import { Component } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * Last line of defence.
 *
 * React unmounts the whole tree when a render throws, leaving a blank page with
 * nothing but a console message. This catches that and shows something a person
 * can act on, with the real error text — on a product about money, a white
 * screen is the worst possible failure mode.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error in the UI:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main className="grid min-h-dvh place-items-center bg-base-950 px-gutter py-16">
        <div className="surface-panel w-full max-w-lg p-7 text-center">
          <h1 className="text-display-sm text-ink-primary">Something broke on this page</h1>
          <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-secondary">
            The page stopped rather than showing numbers that might be wrong.
          </p>

          <pre
            className="mt-5 overflow-x-auto rounded-card border border-hairline bg-base-800/60
                       px-4 py-3 text-left font-mono text-[0.76rem] leading-relaxed text-risk-suspicious"
          >
            {String(error?.message || error)}
          </pre>

          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="inline-flex h-11 items-center gap-2 rounded-pill bg-accent px-5 text-sm
                         font-medium text-base-950 transition-colors duration-base ease-out
                         hover:bg-accent-300 focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-accent focus-visible:ring-offset-2
                         focus-visible:ring-offset-base-950"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
            <a
              href="/dashboard"
              className="inline-flex h-11 items-center rounded-pill border border-hairline-strong
                         px-5 text-sm text-ink-primary transition-colors duration-base ease-out
                         hover:border-accent/50"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </main>
    )
  }
}

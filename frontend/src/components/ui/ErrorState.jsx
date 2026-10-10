import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react'

import { Button } from './Button'

/**
 * A request failed.
 *
 * Shows what the backend actually said rather than a generic apology: "that
 * invoice could not be found" and "the server is unreachable" need different
 * responses from the user, and only one of them is worth retrying.
 */
export function ErrorState({ error, onRetry, title, className = '' }) {
  const offline = error?.isOffline || error?.status === 0
  const message =
    error?.message || 'Something went wrong while loading this. Try again.'

  const Icon = offline ? WifiOff : AlertTriangle

  return (
    <div
      role="alert"
      className={`flex flex-col items-center px-6 py-14 text-center ${className}`}
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl border border-risk-suspicious-edge bg-risk-suspicious-dim">
        <Icon className="h-5 w-5 text-risk-suspicious" strokeWidth={1.7} aria-hidden="true" />
      </span>

      <h3 className="mt-5 text-[1rem] font-semibold text-ink-primary">
        {title || (offline ? 'Cannot reach the server' : 'That did not load')}
      </h3>

      <p className="mt-2 max-w-md text-[0.86rem] leading-relaxed text-ink-secondary">
        {message}
      </p>

      {offline && (
        <p className="mt-2 max-w-md text-[0.78rem] leading-relaxed text-ink-muted">
          Check that the backend is running, then try again.
        </p>
      )}

      {onRetry && (
        <div className="mt-6">
          <Button variant="outline" size="md" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Picks between loading, error, empty and the real content.
 *
 * Having one component decide means no page can accidentally render its
 * content branch while the data is still null — which is exactly the crash
 * this replaces.
 */
export function AsyncState({
  loading,
  error,
  onRetry,
  isEmpty = false,
  skeleton = null,
  empty = null,
  children,
}) {
  if (loading) return skeleton
  if (error) return <ErrorState error={error} onRetry={onRetry} />
  if (isEmpty) return empty
  return children()
}

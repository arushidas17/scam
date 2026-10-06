/**
 * Skeleton placeholders. The shimmer is a background-position animation on a
 * decorative element, and the global reduced-motion rule stops it, leaving a
 * flat block.
 */
export function Skeleton({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`block rounded-md bg-base-700/70 motion-safe:animate-pulse ${className}`}
    />
  )
}

// Ragged line endings read as text rather than as a stack of bars.
const LINE_WIDTHS = ['w-full', 'w-11/12', 'w-10/12', 'w-full', 'w-9/12']

/** A block of skeleton lines, for card and panel bodies. */
export function SkeletonLines({ count = 3, className = '' }) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={`h-3 ${LINE_WIDTHS[i % LINE_WIDTHS.length]}`} />
      ))}
    </div>
  )
}

/**
 * Wraps a loading region so screen readers are told it is busy rather than
 * being read the placeholder shapes.
 */
export function LoadingRegion({ label, children }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

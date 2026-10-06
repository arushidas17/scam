import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function matches() {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches
}

/**
 * Tracks the OS "reduce motion" setting and keeps tracking it, so toggling the
 * preference while the page is open takes effect without a reload.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = (event) => setReduced(event.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return reduced
}

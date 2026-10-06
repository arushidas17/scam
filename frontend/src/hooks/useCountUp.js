import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

/**
 * Counts from 0 to `target` once `active` turns true, then stops for good.
 * With reduced motion it reports the target straight away, with no animation.
 */
export function useCountUp(target, { active = true, duration = 1400 } = {}) {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(0)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!active || reduced || doneRef.current) return

    let frame
    const start = performance.now()

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setValue(target * eased)
      if (t < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        doneRef.current = true
        setValue(target)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, target, duration, reduced])

  // Derived rather than stored, so no render is spent getting to the end state.
  if (reduced) return active ? target : 0
  return value
}

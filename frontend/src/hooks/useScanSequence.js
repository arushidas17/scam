import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

/**
 * Drives the looping hero animation.
 *
 * reset → scan → extract → score → flags → hold → (loop)
 *
 * Returns the current phase, a numeric index for ordering comparisons, and a
 * cycle counter that lets child animations restart cleanly on each loop.
 * With reduced motion it parks on the final state and never loops.
 */
const TIMELINE = [
  ['reset', 320],
  ['scan', 1700],
  ['extract', 1850],
  ['score', 1500],
  ['flags', 1150],
  ['hold', 2600],
]

export const PHASE_ORDER = TIMELINE.map(([name]) => name)

export function useScanSequence({ paused = false } = {}) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  const [cycle, setCycle] = useState(0)
  const timerRef = useRef()

  // Reduced motion parks on the final frame: everything visible, nothing moving.
  const activeStep = reduced ? TIMELINE.length - 1 : step

  useEffect(() => {
    // With reduced motion the step is derived below, so there is nothing to run.
    if (reduced) return
    if (paused) {
      clearTimeout(timerRef.current)
      return
    }

    const [, duration] = TIMELINE[activeStep]
    timerRef.current = setTimeout(() => {
      setStep((prev) => {
        const next = (prev + 1) % TIMELINE.length
        if (next === 0) setCycle((c) => c + 1)
        return next
      })
    }, duration)

    return () => clearTimeout(timerRef.current)
  }, [activeStep, paused, reduced])

  return {
    phase: PHASE_ORDER[activeStep],
    step: activeStep,
    cycle,
    reduced,
    /** True once the sequence has reached `name` (inclusive). */
    reached: (name) => activeStep >= PHASE_ORDER.indexOf(name),
  }
}

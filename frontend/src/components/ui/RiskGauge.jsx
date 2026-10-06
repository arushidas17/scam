import { useEffect, useRef, useState } from 'react'
import { bandForScore } from '../../lib/risk'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/**
 * Circular 0–100 risk gauge. The arc and the number advance together, and the
 * colour follows the band the score lands in, so the gauge turns red only
 * because the score is high — never for decoration.
 *
 * `active` starts the count; `cycleKey` changing restarts it (used by the
 * looping hero sequence).
 */
export function RiskGauge({
  score = 87,
  size = 168,
  stroke = 9,
  active = true,
  cycleKey = 0,
  duration = 1300,
  label = 'Risk score',
  showLabel = true,
  className = '',
}) {
  const reduced = useReducedMotion()
  const frameRef = useRef()

  // The value is tagged with the run that produced it, so a new run (a loop
  // tick, or the gauge going inactive) reads as 0 during render rather than
  // needing a reset write.
  const run = `${active ? 'on' : 'off'}:${cycleKey}`
  const [counter, setCounter] = useState({ run, value: 0 })

  useEffect(() => {
    cancelAnimationFrame(frameRef.current)
    // Reduced motion resolves during render instead, with nothing animating.
    if (!active || reduced) return

    const start = performance.now()
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setCounter({ run, value: t < 1 ? score * eased : score })
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameRef.current)
  }, [active, score, duration, reduced, run])

  const shown = counter.run === run ? counter.value : 0
  const rounded = Math.round(reduced ? (active ? score : 0) : shown)
  const band = bandForScore(rounded)

  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  // Leave a gap at the bottom so the arc reads as a gauge, not a pie.
  const arcFraction = 0.78
  const arcLength = circumference * arcFraction
  const progress = (rounded / 100) * arcLength

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rotate-[129.6deg]"
          role="img"
          aria-label={`${label}: ${rounded} out of 100, ${band.label}`}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(148,174,214,0.14)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          {/* Progress — colour comes from the band */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={band.hex}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            style={{
              transition: reduced ? 'none' : 'stroke 400ms cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono text-[2.1rem] font-semibold leading-none tabular-nums ${band.text}`}
            style={{ fontSize: Math.max(22, size * 0.235) }}
          >
            {rounded}
          </span>
          <span
            className="mt-1 font-mono text-ink-faint"
            style={{ fontSize: Math.max(9, size * 0.062) }}
          >
            / 100
          </span>
        </div>
      </div>

      {showLabel && (
        <div
          className={`mt-3 inline-flex items-center gap-2 rounded-pill border px-3 py-1 ${band.bg} ${band.border}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${band.dot}`} aria-hidden="true" />
          <span className={`text-xs font-medium ${band.text}`}>{band.label}</span>
        </div>
      )}
    </div>
  )
}

import { bandForScore } from '../../lib/risk'

/**
 * A 0–100 score as a number plus a thin proportional bar. The bar length
 * carries the magnitude so the score is readable without relying on its colour.
 */
export function RiskBadge({ score, showBar = true, className = '' }) {
  const band = bandForScore(score)

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className={`w-[2ch] text-right font-mono text-[0.82rem] font-semibold ${band.text}`}>
        {score}
      </span>
      {showBar && (
        <span
          className="h-1 w-12 shrink-0 overflow-hidden rounded-pill bg-base-700"
          aria-hidden="true"
        >
          <span
            className={`block h-full origin-left rounded-pill ${band.bar}`}
            style={{ transform: `scaleX(${Math.max(0.02, score / 100)})` }}
          />
        </span>
      )}
      <span className="sr-only">
        Risk score {score} out of 100, {band.label}
      </span>
    </div>
  )
}

/** Compact square badge for dense lists, where the bar would be noise. */
export function RiskScoreChip({ score, className = '' }) {
  const band = bandForScore(score)
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border font-mono
                  text-[0.84rem] font-semibold ${band.bg} ${band.border} ${band.text} ${className}`}
    >
      {score}
      <span className="sr-only"> out of 100, {band.label}</span>
    </span>
  )
}

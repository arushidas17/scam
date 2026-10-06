import { motion } from 'framer-motion'
import { Logo } from '../ui/Logo'
import { RiskGauge } from '../ui/RiskGauge'
import { useScanSequence } from '../../hooks/useScanSequence'
import { DUR, EASE_OUT } from '../../lib/motion'

const REASONS = [
  'Bank account changed 2 days ago',
  'Reply-to domain is a lookalike',
  'Amount 3.1× vendor average',
]

/**
 * Desktop-only brand half of the auth split. Runs the same sequence hook as the
 * hero, so the gauge here loops in step with the rest of the product's motion.
 */
export function AuthBrandPanel() {
  const { reached, cycle, reduced } = useScanSequence()
  const showScore = reached('score')
  const showFlags = reached('flags')

  return (
    <aside
      className="relative hidden overflow-hidden border-r border-hairline bg-base-900 lg:flex
                 lg:flex-col lg:justify-between"
      aria-label="About Fraud Guardian"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-grid-faint bg-grid mask-fade-radial"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2
                   -translate-y-1/2 rounded-full
                   bg-[radial-gradient(circle,rgba(43,214,255,0.16),transparent_65%)] blur-2xl"
      />

      <div className="relative px-10 pt-10 xl:px-14">
        <Logo />
      </div>

      <div className="relative flex flex-col items-center px-10 py-8 xl:px-14">
        <RiskGauge
          score={87}
          size={132}
          stroke={8}
          active={showScore}
          cycleKey={cycle}
          label="Example invoice risk score"
        />

        <ul className="mt-7 w-full max-w-xs space-y-2">
          {REASONS.map((reason, i) => (
            <motion.li
              key={reason}
              initial={false}
              animate={{
                opacity: showFlags ? 1 : 0,
                x: showFlags || reduced ? 0 : 12,
              }}
              transition={{
                duration: DUR.fast,
                ease: EASE_OUT,
                delay: showFlags && !reduced ? i * 0.1 : 0,
              }}
              className="flex items-start gap-2.5 rounded-md border border-risk-suspicious-edge
                         bg-risk-suspicious-dim px-3 py-2"
            >
              <span
                className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-risk-suspicious"
                aria-hidden="true"
              />
              <span className="text-[0.78rem] leading-snug text-ink-primary">{reason}</span>
            </motion.li>
          ))}
        </ul>

        <p className="mt-6 font-mono text-[0.66rem] text-ink-faint">Sample invoice</p>
      </div>

      <div className="relative px-10 pb-12 xl:px-14">
        <p className="max-w-sm text-[1.15rem] font-medium leading-snug tracking-[-0.015em] text-ink-primary">
          Every invoice scored before the payment leaves — with the reasons spelled out.
        </p>
      </div>
    </aside>
  )
}

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { DUR, EASE_OUT } from '../../lib/motion'

/**
 * The verdict and what to do about it. Given its own treatment — accent, not a
 * risk colour — because it is the product speaking, not a risk level.
 */
export function RecommendationCard({ recommendation, play = false, delay = 1.2, title = 'Recommendation' }) {
  if (!recommendation) return null

  return (
    <motion.section
      initial={play ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.fast, ease: EASE_OUT, delay: play ? delay : 0 }}
      aria-labelledby="recommendation-title"
      className="rounded-card border border-accent/30 bg-accent/[0.06] p-5"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-accent/40 bg-accent/10">
          <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={2} aria-hidden="true" />
        </span>
        <h3 id="recommendation-title" className="text-[0.9rem] font-semibold text-ink-primary">
          {title}
        </h3>
      </div>

      <p className="mt-3.5 text-[0.95rem] font-medium leading-relaxed text-ink-primary">
        {recommendation.verdict}
      </p>

      <ol className="mt-4 space-y-2.5">
        {recommendation.steps.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-accent/40
                         bg-base-900 font-mono text-[0.68rem] font-semibold text-accent"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="text-[0.84rem] leading-relaxed text-ink-secondary">{step}</span>
          </li>
        ))}
      </ol>
    </motion.section>
  )
}

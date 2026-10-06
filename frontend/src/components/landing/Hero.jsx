import { motion } from 'framer-motion'
import { ArrowRight, ArrowDown, ShieldCheck } from 'lucide-react'
import { Button } from '../ui/Button'
import { HeroVisual } from './HeroVisual'
import { riseVariants, sectionVariants } from '../../lib/motion'

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-section sm:pt-32 lg:pt-36 lg:pb-section-lg">
      {/* Faint grid, masked so it dissolves toward the edges */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-grid-faint bg-grid mask-fade-radial"
      />
      {/* Horizon wash at the very top of the page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80
                   bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(43,214,255,0.09),transparent_70%)]"
      />

      <motion.div
        className="shell grid items-center gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16"
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div>
          <motion.p
            variants={riseVariants}
            className="mb-6 inline-flex items-center gap-2 rounded-pill border border-hairline
                       bg-base-900/70 px-3 py-1.5 text-xs text-ink-secondary"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Built for Indian finance and accounts-payable teams
          </motion.p>

          <motion.h1
            variants={riseVariants}
            className="text-display-xl text-ink-primary"
          >
            Stop payment fraud
            <br className="hidden xl:block" />{' '}
            <span className="text-accent">before the money leaves.</span>
          </motion.h1>

          <motion.p
            variants={riseVariants}
            className="mt-6 max-w-xl text-[0.98rem] leading-relaxed text-ink-secondary sm:text-[1.06rem]"
          >
            Fraud Guardian reads every invoice and vendor payment request, checks it against
            your vendor history, and returns a 0–100 risk score with the exact reasons — so
            your team approves with confidence instead of guesswork.
          </motion.p>

          <motion.div variants={riseVariants} className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button to="/signup" size="lg" className="w-full" wrapperClassName="w-full sm:w-auto">
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button href="#how-it-works" variant="outline" size="lg" className="w-full" wrapperClassName="w-full sm:w-auto">
              See how it works
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </motion.div>

          <motion.p
            variants={riseVariants}
            className="mt-6 font-mono text-[0.68rem] leading-relaxed text-ink-faint sm:text-[0.72rem]"
          >
            No card required to start · Your invoices stay in your workspace
          </motion.p>
        </div>

        <motion.div variants={riseVariants}>
          <HeroVisual />
        </motion.div>
      </motion.div>
    </section>
  )
}

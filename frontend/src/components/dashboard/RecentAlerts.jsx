import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { RiskScoreChip } from '../ui/RiskBadge'
import { StatusPill } from '../ui/StatusPill'
import { formatINR } from '../../lib/format'
import { relativeTime } from '../../lib/time'
import { DUR, EASE_OUT } from '../../lib/motion'

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
}

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.fast, ease: EASE_OUT } },
}

/** The highest-risk recent invoices. Each row opens the invoice. */
export function RecentAlerts({ alerts = [] }) {
  if (!alerts.length) {
    return (
      <p className="py-6 text-center text-[0.84rem] text-ink-muted">
        Nothing needs attention right now.
      </p>
    )
  }

  return (
    <motion.ul variants={listVariants} initial="hidden" animate="visible" className="-mx-2">
      {alerts.map((alert) => (
        <motion.li key={alert.id} variants={rowVariants}>
          <Link
            to={`/invoices/${alert.id}`}
            className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors
                       duration-snap ease-out hover:bg-base-800 focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                       focus-visible:ring-offset-base-900"
          >
            <RiskScoreChip score={alert.riskScore} />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="truncate text-[0.86rem] font-medium text-ink-primary">
                  {alert.vendor}
                </p>
                <span className="shrink-0 font-mono text-[0.72rem] text-ink-muted">
                  {alert.invoiceNumber}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[0.78rem] text-ink-secondary">
                {alert.mainFlag ?? 'Flagged for review'}
                <span className="text-ink-faint"> · {relativeTime(alert.receivedAt)}</span>
              </p>
            </div>

            <div className="hidden shrink-0 sm:block">
              <StatusPill status={alert.status} size="sm" />
            </div>

            <span className="shrink-0 text-right font-mono text-[0.84rem] text-ink-primary">
              {formatINR(alert.amount)}
            </span>

            <ChevronRight
              className="h-4 w-4 shrink-0 text-ink-faint transition-colors duration-snap
                         ease-out group-hover:text-ink-secondary"
              aria-hidden="true"
            />
          </Link>
        </motion.li>
      ))}
    </motion.ul>
  )
}

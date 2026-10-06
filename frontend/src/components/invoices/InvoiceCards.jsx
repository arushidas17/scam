import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { RiskBadge } from '../ui/RiskBadge'
import { StatusPill } from '../ui/StatusPill'
import { Skeleton } from '../ui/Skeleton'
import { formatINR } from '../../lib/format'
import { formatDate } from '../../lib/time'
import { DUR, EASE_OUT } from '../../lib/motion'

/** Mobile replacement for the table — one stacked card per invoice. */
export function InvoiceCards({ rows, loading, skeletonRows = 6 }) {
  if (loading) {
    return (
      <ul className="space-y-2.5 p-4">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <li key={i} className="surface p-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-2.5 h-3 w-24" />
            <Skeleton className="mt-4 h-3 w-full" />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="space-y-2.5 p-4">
      {rows.map((row, i) => (
        <motion.li
          key={row.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.fast, ease: EASE_OUT, delay: Math.min(i, 10) * 0.02 }}
        >
          <Link
            to={`/invoices/${row.id}`}
            className="block rounded-card border border-hairline bg-base-900 p-4
                       transition-colors duration-snap ease-out hover:border-hairline-strong
                       hover:bg-base-800 focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-accent focus-visible:ring-offset-2
                       focus-visible:ring-offset-base-950"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[0.88rem] font-medium text-ink-primary">
                  {row.vendor}
                </p>
                <p className="mt-0.5 font-mono text-[0.74rem] text-ink-muted">
                  {row.invoiceNumber}
                </p>
              </div>
              <StatusPill status={row.status} size="sm" />
            </div>

            <div className="mt-3.5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[0.7rem] uppercase tracking-wider text-ink-muted">Amount</p>
                <p className="mt-0.5 font-mono text-[1rem] font-semibold text-ink-primary">
                  {formatINR(row.amount)}
                </p>
              </div>
              <RiskBadge score={row.riskScore} />
            </div>

            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1
                            border-t border-hairline pt-3">
              <p className="font-mono text-[0.72rem] text-ink-muted">
                {formatDate(row.invoiceDate)} · due {formatDate(row.dueDate)}
              </p>
              {row.mainFlag && (
                <p className="truncate text-[0.74rem] text-ink-secondary">{row.mainFlag}</p>
              )}
            </div>
          </Link>
        </motion.li>
      ))}
    </ul>
  )
}

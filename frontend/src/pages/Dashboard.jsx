import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, TrendingUp } from 'lucide-react'
import { PageHeader } from '../components/app/PageHeader'
import { Button } from '../components/ui/Button'
import { StatTile } from '../components/ui/StatTile'
import { Skeleton, SkeletonLines, LoadingRegion } from '../components/ui/Skeleton'
import { InvoicesPerDayChart } from '../components/dashboard/InvoicesPerDayChart'
import { TopRiskReasons } from '../components/dashboard/TopRiskReasons'
import { RecentAlerts } from '../components/dashboard/RecentAlerts'
import { getDashboardStats, getRecentAlerts } from '../services/invoices'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../context/useAuth'
import { RISK_BANDS } from '../lib/risk'
import { formatLongDate, greetingFor } from '../lib/time'
import { DUR, EASE_OUT } from '../lib/motion'

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const tileVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.fast, ease: EASE_OUT } },
}

/** Whole-percent share, so the tiles carry proportion as well as a count. */
function share(part, whole) {
  if (!whole) return '0%'
  return `${Math.round((part / whole) * 100)}%`
}

function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`surface p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[0.92rem] font-semibold text-ink-primary">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  // Pinned at mount: the greeting and the date must not change mid-session.
  const [openedAt] = useState(() => new Date())

  const loadStats = useCallback(() => getDashboardStats(), [])
  const loadAlerts = useCallback(() => getRecentAlerts(8), [])

  const { data: stats, loading: statsLoading } = useAsync(loadStats, [])
  const { data: alerts, loading: alertsLoading } = useAsync(loadAlerts, [])

  const firstName = user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-6">
      <PageHeader
        title={`${greetingFor(openedAt)}, ${firstName}`}
        subtitle={formatLongDate(openedAt)}
        actions={
          <Button to="/upload" size="md">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload invoice
          </Button>
        }
      />

      {/* Status tiles + the wider money-at-risk tile */}
      {statsLoading ? (
        <LoadingRegion label="Loading today’s figures">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="surface p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-7 w-14" />
              </div>
            ))}
            <div className="surface col-span-2 p-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-3 h-9 w-40" />
              <Skeleton className="mt-3 h-3 w-full" />
            </div>
          </div>
        </LoadingRegion>
      ) : (
        <motion.div
          variants={gridVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3 xl:grid-cols-6"
        >
          <motion.div variants={tileVariants}>
            <StatTile
              label="Invoices today"
              value={stats.today}
              hint="Received since midnight."
              hintFromSm
            />
          </motion.div>
          <motion.div variants={tileVariants}>
            <StatTile
              label="Normal"
              value={stats.normal}
              tone={RISK_BANDS.normal}
              hintFromSm
              to="/invoices?status=normal"
              hint={`${share(stats.normal, stats.today)} of today · cleared automatically`}
            />
          </motion.div>
          <motion.div variants={tileVariants}>
            <StatTile
              label="Needs review"
              value={stats.needsReview}
              tone={RISK_BANDS.review}
              hintFromSm
              to="/invoices?status=needs_review"
              hint={`${share(stats.needsReview, stats.today)} of today · waiting on a reviewer`}
            />
          </motion.div>
          <motion.div variants={tileVariants}>
            <StatTile
              label="Suspicious"
              value={stats.suspicious}
              tone={RISK_BANDS.suspicious}
              hintFromSm
              to="/invoices?status=suspicious"
              hint={`${share(stats.suspicious, stats.today)} of today · hold before paying`}
            />
          </motion.div>

          <motion.div variants={tileVariants} className="col-span-2">
            <StatTile
              label="Money at risk"
              value={stats.moneyAtRisk}
              currency
              emphasis
              tone={RISK_BANDS.suspicious}
              hint="Total value of invoices currently flagged Suspicious or Needs Review."
            />
          </motion.div>
        </motion.div>
      )}

      {/* Chart + top reasons */}
      <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
        <Panel
          title="Invoices per day"
          action={
            <span className="font-mono text-[0.72rem] text-ink-muted">Last 14 days</span>
          }
        >
          {statsLoading ? (
            <LoadingRegion label="Loading chart">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="mt-4 h-56 w-full sm:h-64" />
            </LoadingRegion>
          ) : (
            <InvoicesPerDayChart data={stats.perDay} />
          )}
        </Panel>

        <Panel
          title="Top risk reasons"
          action={<TrendingUp className="h-4 w-4 text-ink-muted" aria-hidden="true" />}
        >
          {statsLoading ? (
            <LoadingRegion label="Loading top risk reasons">
              <SkeletonLines count={6} />
            </LoadingRegion>
          ) : (
            <TopRiskReasons reasons={stats.topReasons} />
          )}
        </Panel>
      </div>

      {/* Recent alerts */}
      <Panel
        title="Recent alerts"
        action={
          <Button to="/invoices?status=suspicious" variant="ghost" size="sm">
            View all
          </Button>
        }
      >
        {alertsLoading ? (
          <LoadingRegion label="Loading recent alerts">
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </LoadingRegion>
        ) : (
          <RecentAlerts alerts={alerts} />
        )}
      </Panel>
    </div>
  )
}

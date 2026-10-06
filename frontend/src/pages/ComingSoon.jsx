import { useLocation } from 'react-router-dom'
import { Hammer } from 'lucide-react'
import { PageHeader } from '../components/app/PageHeader'
import { Button } from '../components/ui/Button'
import { titleForPath } from '../components/app/navItems'

/**
 * Stand-in for the screens not built yet (Vendors, Payment checker, Settings,
 * invoice detail). Everything that links to them lands here.
 */
export default function ComingSoon() {
  const { pathname } = useLocation()
  const title = titleForPath(pathname)

  return (
    <div className="mx-auto w-full max-w-[82rem]">
      <PageHeader title={title} />

      <div className="surface mt-6 flex flex-col items-center px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl border border-hairline bg-base-800">
          <Hammer className="h-5 w-5 text-accent" strokeWidth={1.6} aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-[1.05rem] font-semibold text-ink-primary">
          {title} is not built yet
        </h3>
        <p className="mt-2 max-w-md text-[0.88rem] leading-relaxed text-ink-secondary">
          This screen is a placeholder for a later milestone. The dashboard, upload flow and
          invoice list are live.
        </p>
        <p className="mt-3 font-mono text-[0.72rem] text-ink-faint">{pathname}</p>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Button to="/dashboard" variant="outline" size="md">
            Back to dashboard
          </Button>
          <Button to="/invoices" variant="ghost" size="md">
            View invoices
          </Button>
        </div>
      </div>
    </div>
  )
}

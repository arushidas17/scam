import { Link } from 'react-router-dom'
import { Logo } from '../ui/Logo'

const GROUPS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Security', href: '#security' },
      { label: 'Detection checks', href: '#features' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', to: '/login' },
      { label: 'Create account', to: '/signup' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of service', href: '#' },
      { label: 'Privacy policy', href: '#' },
      { label: 'Data processing', href: '#' },
    ],
  },
]

// Read once at module load rather than on every render.
const YEAR = new Date().getFullYear()

const linkClass =
  'text-[0.85rem] text-ink-secondary transition-colors duration-base ease-out hover:text-ink-primary'

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-base-900/40">
      <div className="shell grid gap-10 py-14 md:grid-cols-[1.4fr_2fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[0.85rem] leading-relaxed text-ink-secondary">
            Invoice and payment fraud detection for finance and accounts-payable teams.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-[0.73rem] font-medium uppercase tracking-wider text-ink-muted">
                {group.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to} className={linkClass}>
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className={linkClass}>
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="shell flex flex-col gap-3 border-t border-hairline py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-[0.72rem] text-ink-faint">
          © {YEAR} Fraud Guardian. All rights reserved.
        </p>
        <p className="font-mono text-[0.72rem] text-ink-faint">Made for finance teams in India</p>
      </div>
    </footer>
  )
}

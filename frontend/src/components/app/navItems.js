import {
  LayoutDashboard,
  Upload,
  FileText,
  Building2,
  ShieldCheck,
  Settings,
} from 'lucide-react'

/** The one source for the sidebar; routes not built yet land on /coming-soon. */
export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload invoice', icon: Upload },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/vendors', label: 'Vendors', icon: Building2, placeholder: true },
  { to: '/payment-checker', label: 'Payment checker', icon: ShieldCheck, placeholder: true },
  { to: '/settings', label: 'Settings', icon: Settings, placeholder: true },
]

/**
 * Page title for the top bar. Nested detail routes are named first, because a
 * prefix match against the nav item would otherwise swallow them.
 */
export function titleForPath(pathname) {
  if (pathname.startsWith('/invoices/')) return 'Invoice detail'
  if (pathname.startsWith('/vendors/')) return 'Vendor profile'

  const match = [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  return match ? match.label : 'Fraud Guardian'
}

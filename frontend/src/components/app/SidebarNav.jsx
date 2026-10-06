import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { NAV_ITEMS } from './navItems'
import { DUR, EASE_OUT } from '../../lib/motion'

/**
 * Nav list with a single accent bar that slides between items.
 *
 * The bar is one shared layoutId, so Framer animates it from the old item to
 * the new one instead of cross-fading two separate bars.
 */
export function SidebarNav({ collapsed = false, onNavigate, layoutGroup = 'sidebar' }) {
  const { pathname } = useLocation()

  return (
    <nav aria-label="Sections" className="px-3">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`)
          const Icon = item.icon

          return (
            <li key={item.to} className="relative">
              {active && (
                <motion.span
                  layoutId={`${layoutGroup}-active`}
                  className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-pill bg-accent"
                  transition={{ duration: DUR.fast, ease: EASE_OUT }}
                  aria-hidden="true"
                />
              )}

              <NavLink
                to={item.to}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
                className={[
                  'relative flex items-center gap-3 rounded-lg py-2.5 text-[0.86rem]',
                  'transition-colors duration-snap ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  'focus-visible:ring-offset-2 focus-visible:ring-offset-base-900',
                  collapsed ? 'justify-center px-2' : 'px-3',
                  active
                    ? 'bg-base-800 font-medium text-ink-primary'
                    : 'text-ink-secondary hover:bg-base-800/70 hover:text-ink-primary',
                ].join(' ')}
              >
                <Icon
                  className={`h-[1.05rem] w-[1.05rem] shrink-0 ${active ? 'text-accent' : ''}`}
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
                {collapsed ? (
                  <span className="sr-only">{item.label}</span>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar, SidebarDrawer } from './Sidebar'
import { TopBar } from './TopBar'
import { titleForPath } from './navItems'
import { DUR, EASE_OUT } from '../../lib/motion'

const COLLAPSE_KEY = 'fg.sidebarCollapsed'

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/** Signed-in chrome: rail on desktop, drawer on mobile, top bar above content. */
export function AppShell({ alertCount = 0 }) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // Non-fatal: the preference just will not persist.
      }
      return next
    })
  }

  // Close the drawer whenever the route changes, adopted during render so it
  // never costs a second pass.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    if (drawerOpen) setDrawerOpen(false)
  }

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  return (
    <div className="flex min-h-dvh bg-base-950">
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={titleForPath(location.pathname)}
          onOpenDrawer={() => setDrawerOpen(true)}
          alertCount={alertCount}
        />

        {/* Keyed on the path so each route fades and rises on arrival. */}
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.fast, ease: EASE_OUT }}
          className="flex-1 px-gutter py-6 sm:px-5 lg:px-7 lg:py-8"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  )
}

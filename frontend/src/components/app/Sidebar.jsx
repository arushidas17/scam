import { motion, AnimatePresence } from 'framer-motion'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { Logo, LogoMark } from '../ui/Logo'
import { SidebarNav } from './SidebarNav'
import { DUR, EASE_OUT } from '../../lib/motion'

/** Desktop rail. Width is the only thing that changes when it collapses. */
export function Sidebar({ collapsed, onToggle }) {
  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-hairline bg-base-900
                  transition-[width] duration-base ease-out lg:flex
                  ${collapsed ? 'w-[4.5rem]' : 'w-[15rem]'}`}
      aria-label="Primary"
    >
      <div
        className={`flex h-16 items-center border-b border-hairline
                    ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}
      >
        {collapsed ? (
          <Logo to="/dashboard" withWordmark={false} markClassName="h-8 w-8" />
        ) : (
          <Logo to="/dashboard" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav collapsed={collapsed} />
      </div>

      <div className={`border-t border-hairline p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className={`flex items-center gap-2.5 rounded-lg py-2 text-[0.82rem] text-ink-muted
                      transition-colors duration-snap ease-out hover:bg-base-800 hover:text-ink-primary
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                      focus-visible:ring-offset-2 focus-visible:ring-offset-base-900
                      ${collapsed ? 'px-2' : 'w-full px-3'}`}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
          )}
          {collapsed ? (
            <span className="sr-only">Expand sidebar</span>
          ) : (
            <span>Collapse sidebar</span>
          )}
        </button>
      </div>
    </aside>
  )
}

/** Mobile drawer: the same nav, slid in over a scrim. */
export function SidebarDrawer({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.snap, ease: EASE_OUT }}
            className="absolute inset-0 h-full w-full cursor-default bg-base-950/70 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: DUR.fast, ease: EASE_OUT }}
            className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col
                       border-r border-hairline bg-base-900 shadow-panel"
          >
            <div className="flex h-16 items-center justify-between border-b border-hairline px-4">
              <Logo to="/dashboard" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-lg text-ink-secondary
                           transition-colors duration-snap ease-out hover:bg-base-800 hover:text-ink-primary"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <SidebarNav onNavigate={onClose} layoutGroup="drawer" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export { LogoMark }

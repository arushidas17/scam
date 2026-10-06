import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { DUR, EASE_OUT } from '../../lib/motion'

function initials(user) {
  const source = user?.fullName || user?.email || 'U'
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return (parts[0]?.[0] ?? 'U').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase()
}

export function UserMenu() {
  const { user, logOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)

  // Close on an outside click or Escape, and return focus to the trigger.
  useEffect(() => {
    if (!open) return

    const onPointer = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleLogOut = async () => {
    setBusy(true)
    // Leave the protected area first. Clearing the session while still on a
    // guarded route makes ProtectedRoute bounce with a "from" location, and
    // the next login would drop them back on the page they just left.
    navigate('/login', { replace: true })
    await logOut()
  }

  const name = user?.fullName || user?.email?.split('@')[0] || 'Signed in'

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-pill border border-hairline bg-base-800/60 py-1
                   pl-1 pr-2 transition-colors duration-snap ease-out hover:border-hairline-strong
                   hover:bg-base-800 focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base-950"
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15
                     font-mono text-[0.7rem] font-semibold text-accent"
          aria-hidden="true"
        >
          {initials(user)}
        </span>
        <span className="hidden max-w-[9rem] truncate text-[0.82rem] text-ink-secondary sm:block">
          {name}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform duration-snap ease-out
                      ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
        <span className="sr-only">Account menu</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: DUR.snap, ease: EASE_OUT }}
            className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-card border
                       border-hairline bg-base-900 shadow-panel"
          >
            <div className="border-b border-hairline px-4 py-3">
              <p className="truncate text-[0.85rem] font-medium text-ink-primary">{name}</p>
              <p className="truncate font-mono text-[0.72rem] text-ink-muted">{user?.email}</p>
            </div>

            <div className="p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  navigate('/settings')
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left
                           text-[0.84rem] text-ink-secondary transition-colors duration-snap ease-out
                           hover:bg-base-800 hover:text-ink-primary focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleLogOut}
                disabled={busy}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left
                           text-[0.84rem] text-ink-secondary transition-colors duration-snap ease-out
                           hover:bg-base-800 hover:text-ink-primary focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {busy ? 'Logging out…' : 'Log out'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { UserRound }

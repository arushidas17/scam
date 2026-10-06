import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Logo } from '../ui/Logo'
import { Button } from '../ui/Button'
import { DUR, EASE_OUT } from '../../lib/motion'

const LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Security', href: '#security' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Lock the page behind the open mobile sheet.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-base ease-out',
        scrolled || open
          ? 'border-b border-hairline bg-base-950/80 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      ].join(' ')}
    >
      <nav className="shell flex h-16 items-center justify-between gap-6" aria-label="Main">
        <Logo />

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-pill px-3 py-2 text-sm text-ink-secondary transition-colors
                           duration-base ease-out hover:bg-base-800 hover:text-ink-primary"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <Button to="/login" variant="ghost" size="sm">
            Log in
          </Button>
          <Button to="/signup" variant="primary" size="sm">
            Get started
          </Button>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg border border-hairline
                     bg-base-900/60 text-ink-primary md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DUR.fast, ease: EASE_OUT }}
            className="border-t border-hairline bg-base-950/95 backdrop-blur-xl md:hidden"
          >
            <ul className="shell flex flex-col gap-1 py-4">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-3 text-[0.95rem] text-ink-secondary
                               hover:bg-base-800 hover:text-ink-primary"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="shell flex flex-col gap-2.5 border-t border-hairline py-4">
              <Button to="/login" variant="outline" size="md" fullWidth>
                Log in
              </Button>
              <Button to="/signup" variant="primary" size="md" fullWidth>
                Get started
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

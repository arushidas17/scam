import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { DUR, EASE_OUT } from '../../lib/motion'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialog: traps Tab inside itself, closes on Escape, and returns focus to
 * whatever opened it. Rendered in a portal so no ancestor's overflow or stacking
 * context can clip it.
 */
export function Dialog({ open, onClose, title, description, children, footer, labelledBy }) {
  const panelRef = useRef(null)
  const openerRef = useRef(null)

  // Remember the trigger while opening, restore focus to it on close.
  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement
      return
    }
    const opener = openerRef.current
    if (opener && document.contains(opener)) opener.focus()
  }, [open])

  // Move focus into the panel once it exists.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      const first = panel.querySelector(FOCUSABLE)
      ;(first ?? panel).focus()
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  // Escape closes; Tab cycles within the panel.
  useEffect(() => {
    if (!open) return

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (!items.length) {
        event.preventDefault()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  // Hold the page still behind the dialog.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.snap, ease: EASE_OUT }}
            onClick={onClose}
            className="absolute inset-0 bg-base-950/75 backdrop-blur-sm"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy ?? 'dialog-title'}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: DUR.fast, ease: EASE_OUT }}
            className="relative w-full max-w-lg overflow-hidden rounded-t-panel border border-hairline
                       bg-base-900 shadow-panel focus:outline-none sm:rounded-panel"
          >
            <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
              <div className="min-w-0">
                <h2 id={labelledBy ?? 'dialog-title'} className="text-[1rem] font-semibold text-ink-primary">
                  {title}
                </h2>
                {description && (
                  <p className="mt-1 text-[0.84rem] leading-relaxed text-ink-secondary">{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted
                           transition-colors duration-snap ease-out hover:bg-base-800 hover:text-ink-primary
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">{children}</div>

            {footer && (
              <div className="flex flex-col-reverse gap-2.5 border-t border-hairline px-5 py-4 sm:flex-row sm:justify-end">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

import { createContext, useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Info, X, AlertTriangle } from 'lucide-react'
import { DUR, EASE_OUT } from '../../lib/motion'

const ToastContext = createContext(null)

const ICONS = { success: Check, info: Info, warning: AlertTriangle }

/**
 * Toasts. Announced through a polite live region rather than stealing focus,
 * so a decision confirmation does not interrupt a keyboard user mid-task.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    ({ title, body = null, tone = 'success', action = null, duration = 6000 }) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      setToasts((prev) => [...prev, { id, title, body, tone, action }])
      if (duration) setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex flex-col items-center
                       gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
          >
            <AnimatePresence initial={false}>
              {toasts.map((t) => {
                const Icon = ICONS[t.tone] ?? Info
                return (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: DUR.fast, ease: EASE_OUT }}
                    className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card
                               border border-hairline-strong bg-base-800 px-4 py-3 shadow-panel"
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                        t.tone === 'warning' ? 'bg-risk-review/20 text-risk-review' : 'bg-accent/20 text-accent'
                      }`}
                      aria-hidden="true"
                    >
                      <Icon className="h-3 w-3" strokeWidth={3} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-[0.86rem] font-medium text-ink-primary">{t.title}</p>
                      {t.body && (
                        <p className="mt-0.5 text-[0.8rem] leading-relaxed text-ink-secondary">{t.body}</p>
                      )}
                      {t.action && (
                        <button
                          type="button"
                          onClick={() => {
                            t.action.onClick()
                            dismiss(t.id)
                          }}
                          className="mt-2 text-[0.8rem] font-medium text-accent transition-colors
                                     duration-snap ease-out hover:text-accent-300 focus-visible:outline-none
                                     focus-visible:ring-2 focus-visible:ring-accent rounded"
                        >
                          {t.action.label}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => dismiss(t.id)}
                      aria-label="Dismiss notification"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-muted
                                 transition-colors duration-snap ease-out hover:text-ink-primary
                                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

export { ToastContext }

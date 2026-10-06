/** Date and time formatting, all en-IN so the app reads the same everywhere. */

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const DATE_SHORT_FMT = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' })

const LONG_FMT = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** "06 Oct 2026" */
export function formatDate(value) {
  if (!value) return '—'
  return DATE_FMT.format(new Date(value))
}

/** "06 Oct" — for dense table columns and chart axes. */
export function formatDateShort(value) {
  if (!value) return '—'
  return DATE_SHORT_FMT.format(new Date(value))
}

/** "Tuesday, 6 October 2026" — the dashboard header. */
export function formatLongDate(value) {
  return LONG_FMT.format(new Date(value))
}

/** "yyyy-mm-dd", for <input type="date"> round-trips. */
export function toDateInput(value) {
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

/** "12 min ago", "3 hours ago", "just now". */
export function relativeTime(value, now = new Date()) {
  const seconds = Math.max(0, Math.floor((now - new Date(value)) / 1000))
  if (seconds < 60) return 'just now'

  for (const [unit, size] of UNITS) {
    const amount = Math.floor(seconds / size)
    if (amount >= 1) {
      const label = unit === 'minute' ? 'min' : amount === 1 ? unit : `${unit}s`
      return `${amount} ${label} ago`
    }
  }
  return 'just now'
}

/** The greeting that fits the hour the page was opened. */
export function greetingFor(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

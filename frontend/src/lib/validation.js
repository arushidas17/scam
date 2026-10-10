// Plain-language validation. Messages say what to do, not what went wrong.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Consumer providers. These are perfectly valid addresses — the list only
// drives a soft hint, never a rejection. Someone evaluating the product should
// not be blocked at the door because they signed up with a personal address.
const FREE_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.in',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'rediffmail.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
])

/**
 * A real error, shown in red and blocking submission.
 *
 * Only the address being malformed qualifies. Which provider it belongs to is
 * not a correctness problem, so it never produces an error here.
 */
export function validateEmail(value) {
  const email = value.trim()
  if (!email) return 'Enter your email address.'
  if (!EMAIL_RE.test(email)) return 'That does not look like an email address yet.'
  return ''
}

/**
 * A soft, non-blocking note for consumer addresses.
 *
 * Returns '' for anything else, so the field shows nothing in the common case.
 * This is advice, not validation: it is rendered as a grey hint and the form
 * submits regardless.
 */
export function freeEmailHint(value) {
  const email = (value || '').trim()
  if (!email || !EMAIL_RE.test(email)) return ''
  const domain = email.split('@')[1]?.toLowerCase()
  if (!FREE_DOMAINS.has(domain)) return ''
  return 'Personal email is fine for now. A work email helps us link you to your company.'
}

export function validateRequired(value, label) {
  return value.trim() ? '' : `Enter your ${label}.`
}

export function validateLoginPassword(value) {
  return value ? '' : 'Enter your password.'
}

export function validateNewPassword(value) {
  if (!value) return 'Choose a password.'
  if (value.length < 8) return 'Use at least 8 characters.'
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return 'Mix in at least one letter and one number.'
  }
  return ''
}

export function validateTerms(checked) {
  return checked ? '' : 'Please accept the terms to create an account.'
}

/**
 * Password strength on a 0–4 scale with a label and the next thing to improve.
 * Deliberately not colour-coded red/amber/green — those belong to risk — so the
 * meter uses the accent ramp and neutral greys instead.
 */
export function passwordStrength(value) {
  if (!value) return { score: 0, label: 'Empty', hint: 'At least 8 characters.' }

  let score = 0
  if (value.length >= 8) score += 1
  if (value.length >= 12) score += 1
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1
  if (/[0-9]/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  score = Math.min(score, 4)

  let hint = ''
  if (value.length < 8) hint = 'At least 8 characters.'
  else if (!/[0-9]/.test(value)) hint = 'Add a number.'
  else if (!(/[A-Z]/.test(value) && /[a-z]/.test(value))) hint = 'Mix upper and lower case.'
  else if (!/[^A-Za-z0-9]/.test(value)) hint = 'A symbol would make it stronger.'
  else if (value.length < 12) hint = 'A longer passphrase is stronger still.'

  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
  return { score, label: labels[score], hint }
}

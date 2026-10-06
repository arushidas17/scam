// Field rules for the extraction review form. Messages say what to do.

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/
const IFSC_RE = /^[A-Z]{4}0[0-9A-Z]{6}$/

export function validateGstin(value) {
  const v = value.trim().toUpperCase()
  if (!v) return 'Enter the GSTIN.'
  if (v.length !== 15) return `A GSTIN is 15 characters. This one has ${v.length}.`
  if (!GSTIN_RE.test(v)) return 'That is 15 characters but not a valid GSTIN pattern.'
  return ''
}

export function validateIfsc(value) {
  const v = value.trim().toUpperCase()
  if (!v) return 'Enter the IFSC code.'
  if (v.length !== 11) return `An IFSC code is 11 characters. This one has ${v.length}.`
  if (!IFSC_RE.test(v)) return 'An IFSC code is 4 letters, then 0, then 6 characters.'
  return ''
}

export function validateAmount(value, label = 'amount') {
  const v = String(value).trim()
  if (!v) return `Enter the ${label}.`
  if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(v.replace(/,/g, ''))) {
    return `Enter the ${label} as a number, with no symbols.`
  }
  if (Number(v.replace(/,/g, '')) <= 0) return `The ${label} must be more than zero.`
  return ''
}

export function validateText(value, label) {
  return value.trim() ? '' : `Enter the ${label}.`
}

export function validateDate(value, label) {
  if (!value.trim()) return `Enter the ${label}.`
  if (Number.isNaN(new Date(value).getTime())) return `Enter the ${label} as a valid date.`
  return ''
}

export function validateEmailField(value) {
  const v = value.trim()
  if (!v) return 'Enter the sender email.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'That does not look like an email address.'
  return ''
}

/** The form's field definitions, in the order they are shown and filled in. */
export const EXTRACTION_FIELDS = [
  { key: 'vendor', label: 'Vendor', type: 'text', validate: (v) => validateText(v, 'vendor name') },
  { key: 'invoiceNumber', label: 'Invoice Number', type: 'text', mono: true, validate: (v) => validateText(v, 'invoice number') },
  { key: 'invoiceDate', label: 'Invoice Date', type: 'date', mono: true, validate: (v) => validateDate(v, 'invoice date') },
  { key: 'dueDate', label: 'Due Date', type: 'date', mono: true, validate: (v) => validateDate(v, 'due date') },
  { key: 'amount', label: 'Amount', type: 'text', mono: true, prefix: '₹', validate: (v) => validateAmount(v, 'amount') },
  { key: 'gstAmount', label: 'GST Amount', type: 'text', mono: true, prefix: '₹', validate: (v) => validateAmount(v, 'GST amount') },
  { key: 'gstin', label: 'GSTIN', type: 'text', mono: true, uppercase: true, validate: validateGstin },
  { key: 'bankAccount', label: 'Bank Account', type: 'text', mono: true, validate: (v) => validateText(v, 'bank account') },
  { key: 'ifsc', label: 'IFSC', type: 'text', mono: true, uppercase: true, validate: validateIfsc },
  { key: 'senderEmail', label: 'Sender Email', type: 'email', mono: true, validate: validateEmailField },
]

/** Below this, a field is marked "Please check" rather than trusted. */
export const CONFIDENCE_THRESHOLD = 0.8

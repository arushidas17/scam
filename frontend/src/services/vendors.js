/**
 * Mock vendor API. Same contract as the invoice service: async, 400–900ms,
 * and the only thing the vendor pages talk to.
 */
import { INVOICES, VENDORS, VENDOR_BY_ID, NOW } from '../lib/mockInvoices'

const MIN_MS = 400
const MAX_MS = 900

function latency() {
  return new Promise((resolve) => setTimeout(resolve, MIN_MS + Math.random() * (MAX_MS - MIN_MS)))
}

const DAY = 86400000

/** Trusted is a reviewer's judgement, so it is editable and held per session. */
const trustOverrides = new Map()

function isTrusted(vendor) {
  return trustOverrides.has(vendor.id) ? trustOverrides.get(vendor.id) : vendor.trusted
}

function invoicesFor(vendorId) {
  return INVOICES.filter((row) => row.vendorId === vendorId)
}

/** The figures every vendor row and profile header shares. */
function summarise(vendor) {
  const rows = invoicesFor(vendor.id)
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  const flagged = rows.filter((row) => row.status !== 'normal').length
  const lastInvoice = rows.reduce(
    (latest, row) => (!latest || new Date(row.invoiceDate) > new Date(latest) ? row.invoiceDate : latest),
    null,
  )

  const lastChange = vendor.bankChanges[0] ?? null
  const bankChangedRecently =
    !!lastChange && NOW - new Date(lastChange.changedOn) <= 30 * DAY

  return {
    id: vendor.id,
    name: vendor.name,
    domain: vendor.domain,
    gstin: vendor.gstin,
    firstSeen: vendor.firstSeen,
    trusted: isTrusted(vendor),
    invoiceCount: rows.length,
    totalValue: total,
    averageAmount: rows.length ? Math.round(total / rows.length) : 0,
    lastInvoiceDate: lastInvoice,
    flaggedCount: flagged,
    bankChangedRecently,
    lastBankChangeOn: lastChange?.changedOn ?? null,
    /** No settled history yet, or first seen inside the last 60 days. */
    isNew: rows.length <= 1 || NOW - new Date(vendor.firstSeen) <= 60 * DAY,
  }
}

const SORTERS = {
  name: (a, b) => a.name.localeCompare(b.name),
  gstin: (a, b) => a.gstin.localeCompare(b.gstin),
  domain: (a, b) => a.domain.localeCompare(b.domain),
  invoiceCount: (a, b) => a.invoiceCount - b.invoiceCount,
  averageAmount: (a, b) => a.averageAmount - b.averageAmount,
  lastInvoiceDate: (a, b) => new Date(a.lastInvoiceDate ?? 0) - new Date(b.lastInvoiceDate ?? 0),
  flaggedCount: (a, b) => a.flaggedCount - b.flaggedCount,
}

export const VENDOR_TABS = [
  { key: 'all', label: 'All' },
  { key: 'trusted', label: 'Trusted' },
  { key: 'new', label: 'New' },
  { key: 'flagged', label: 'Flagged' },
]

function matchesTab(vendor, tab) {
  if (tab === 'trusted') return vendor.trusted
  if (tab === 'new') return vendor.isNew
  if (tab === 'flagged') return vendor.flaggedCount > 0
  return true
}

/** Search, filter and sort the vendor list. Counts cover every tab. */
export async function listVendors({ tab = 'all', search = '', sort = 'name', direction = 'asc' } = {}) {
  await latency()

  let rows = VENDORS.map(summarise)

  const term = search.trim().toLowerCase()
  if (term) {
    rows = rows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.domain.toLowerCase().includes(term) ||
        row.gstin.toLowerCase().includes(term),
    )
  }

  const counts = {
    all: rows.length,
    trusted: rows.filter((r) => matchesTab(r, 'trusted')).length,
    new: rows.filter((r) => matchesTab(r, 'new')).length,
    flagged: rows.filter((r) => matchesTab(r, 'flagged')).length,
  }

  if (tab !== 'all') rows = rows.filter((row) => matchesTab(row, tab))

  const sorter = SORTERS[sort] ?? SORTERS.name
  rows = [...rows].sort((a, b) => (direction === 'asc' ? sorter(a, b) : -sorter(a, b)))

  return { rows, counts, total: rows.length }
}

/** One vendor with the history both charts and the timeline need. */
export async function getVendor(id) {
  await latency()

  const vendor = VENDOR_BY_ID.get(id)
  if (!vendor) throw new Error('That vendor could not be found.')

  const rows = invoicesFor(id)
  const summary = summarise(vendor)

  // Oldest first — the trend chart reads left to right.
  const trend = [...rows]
    .sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate))
    .map((row) => ({
      id: row.id,
      date: row.invoiceDate,
      invoiceNumber: row.invoiceNumber,
      amount: row.amount,
      status: row.status,
      riskScore: row.riskScore,
    }))

  return {
    ...summary,
    phoneOnRecord: vendor.phoneOnRecord,
    bankAccount: vendor.bankAccount,
    ifsc: vendor.ifsc,
    bankChanges: vendor.bankChanges.map((change) => ({ ...change })),
    trend,
    invoices: rows.map((row) => ({ ...row })),
  }
}

/** Flip a vendor's Trusted badge. Session-only, like the decisions. */
export async function setVendorTrusted(id, trusted) {
  await latency()
  const vendor = VENDOR_BY_ID.get(id)
  if (!vendor) throw new Error('That vendor could not be found.')
  trustOverrides.set(id, trusted)
  return { id, trusted }
}

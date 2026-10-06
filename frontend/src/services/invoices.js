/**
 * Mock invoice API.
 *
 * Pages call only these functions, never the mock data directly, so a real
 * backend is a change to this file alone. Every function is async and takes
 * 400–900ms, which is what the skeleton states on each page are built around.
 */
import { INVOICES, VENDOR_BY_ID, ALL_FLAGS, NOW } from '../lib/mockInvoices'
import { BAND_ORDER, statusForScore } from '../lib/risk'

const MIN_MS = 400
const MAX_MS = 900

function latency() {
  const ms = MIN_MS + Math.random() * (MAX_MS - MIN_MS)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Rows added during this session (an upload) sit in front of the corpus. */
let sessionRows = []

function corpus() {
  return [...sessionRows, ...INVOICES]
}

const TODAY = { normal: 121, needs_review: 14, suspicious: 7 }

/**
 * The headline figures for today.
 *
 * These are sample figures for a full day of traffic. The browsable corpus in
 * /invoices is a smaller 40-row sample, so the tiles here are deliberately on a
 * different scale from the list — the chart below is generated to match THESE
 * numbers, so the dashboard reads consistently as a unit. A real endpoint
 * replaces both and the two scales converge.
 */
export async function getDashboardStats() {
  await latency()

  return {
    today: TODAY.normal + TODAY.needs_review + TODAY.suspicious,
    normal: TODAY.normal,
    needsReview: TODAY.needs_review,
    suspicious: TODAY.suspicious,
    moneyAtRisk: 842000,
    /** Last 14 days, oldest first, split by status — for the stacked chart. */
    perDay: buildPerDay(14),
    /** Ranked flag types across the corpus — for "Top risk reasons". */
    topReasons: buildTopReasons(corpus()),
  }
}

/**
 * A deterministic 14-day series at the same scale as the tiles, ending on
 * today's exact split. Weekends dip, the way real AP volume does.
 */
function buildPerDay(days) {
  const buckets = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(NOW)
    day.setDate(day.getDate() - offset)
    day.setHours(0, 0, 0, 0)

    if (offset === 0) {
      buckets.push({ date: day.toISOString(), ...TODAY, total: TODAY.normal + TODAY.needs_review + TODAY.suspicious })
      continue
    }

    const weekend = day.getDay() === 0 || day.getDay() === 6
    // Stable pseudo-variation keyed off the date, so the chart never reshuffles.
    const wobble = ((day.getDate() * 37) % 19) - 9
    const total = Math.max(12, Math.round((weekend ? 48 : 138) + wobble))

    const suspicious = Math.max(1, Math.round(total * 0.05))
    const needsReview = Math.max(2, Math.round(total * 0.1))

    buckets.push({
      date: day.toISOString(),
      normal: total - suspicious - needsReview,
      needs_review: needsReview,
      suspicious,
      total,
    })
  }

  return buckets
}

function buildTopReasons(rows) {
  const counts = new Map(ALL_FLAGS.map((flag) => [flag, 0]))

  for (const row of rows) {
    for (const flag of row.flags) {
      counts.set(flag.title, (counts.get(flag.title) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([flag, count]) => ({ flag, count }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.flag.localeCompare(b.flag))
}

/** The highest-risk recent invoices, for the dashboard's alert list. */
export async function getRecentAlerts(limit = 8) {
  await latency()

  return corpus()
    .filter((row) => row.status !== 'normal')
    .sort((a, b) => b.riskScore - a.riskScore || new Date(b.receivedAt) - new Date(a.receivedAt))
    .slice(0, limit)
    .map((row) => ({ ...row }))
}

const SORTERS = {
  invoiceNumber: (a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber),
  vendor: (a, b) => a.vendor.localeCompare(b.vendor),
  invoiceDate: (a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate),
  dueDate: (a, b) => new Date(a.dueDate) - new Date(b.dueDate),
  amount: (a, b) => a.amount - b.amount,
  riskScore: (a, b) => a.riskScore - b.riskScore,
  status: (a, b) => a.riskScore - b.riskScore,
  mainFlag: (a, b) => (a.mainFlag ?? '').localeCompare(b.mainFlag ?? ''),
}

/**
 * Filter, search, sort and page the invoice list.
 *
 * Returns the page of rows plus the counts for every status tab, which are
 * computed before the status filter is applied so the tabs stay stable.
 */
export async function listInvoices({
  status = 'all',
  search = '',
  from = null,
  to = null,
  sort = 'receivedAt',
  direction = 'desc',
  page = 1,
  pageSize = 15,
} = {}) {
  await latency()

  let rows = corpus()

  // Date range first — the tab counts should reflect it.
  if (from) {
    const start = new Date(from)
    start.setHours(0, 0, 0, 0)
    rows = rows.filter((row) => new Date(row.invoiceDate) >= start)
  }
  if (to) {
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)
    rows = rows.filter((row) => new Date(row.invoiceDate) <= end)
  }

  const term = search.trim().toLowerCase()
  if (term) {
    rows = rows.filter(
      (row) =>
        row.vendor.toLowerCase().includes(term) ||
        row.invoiceNumber.toLowerCase().includes(term),
    )
  }

  // Counts for the filter tabs, before the status filter narrows things.
  const counts = {
    all: rows.length,
    normal: 0,
    needs_review: 0,
    suspicious: 0,
  }
  for (const row of rows) counts[row.status] += 1

  if (status !== 'all') {
    rows = rows.filter((row) => row.status === status)
  }

  const totalValue = rows.reduce((sum, row) => sum + row.amount, 0)

  const sorter = SORTERS[sort] ?? ((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt))
  rows = [...rows].sort((a, b) => (direction === 'asc' ? sorter(a, b) : -sorter(a, b)))

  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * pageSize

  return {
    rows: rows.slice(start, start + pageSize).map((row) => ({ ...row })),
    total,
    totalValue,
    counts,
    page: safePage,
    pageCount,
    pageSize,
  }
}

/**
 * The review queue, in the order a reviewer works through it: riskiest first.
 * Drives the Previous / Next controls on the detail page.
 */
function reviewQueue() {
  return corpus()
    .filter((row) => row.status !== 'normal')
    .sort((a, b) => b.riskScore - a.riskScore || new Date(b.receivedAt) - new Date(a.receivedAt))
}

/** Decisions taken this session, keyed by invoice id. */
const decisions = new Map()

const DECISION_LABELS = {
  approve: 'Approved for payment',
  reject: 'Rejected',
  escalate: 'Escalated to finance lead',
}

/**
 * What a reviewer should actually do, derived from the flags that fired rather
 * than written per invoice, so it stays true if the flags change.
 */
function buildRecommendation(row, vendor) {
  if (!row.flags.length) {
    return {
      verdict: 'No issues found. This invoice can follow the normal approval path.',
      steps: ['Approve through the usual process.'],
    }
  }

  const has = (id) => row.flags.some((f) => f.id === id)
  const steps = []

  if (has('bank_account_changed') || has('ifsc_changed')) {
    steps.push(
      `Call ${vendor.name} on ${vendor.phoneOnRecord} — the number already on record, not any number in the email — and confirm the account change with a named contact.`,
    )
  }
  if (has('lookalike_domain')) {
    steps.push(
      `Check the sender's domain against ${vendor.domain} character by character, and do not reply to the email; start a new one to the address on record.`,
    )
  }
  if (has('duplicate_invoice')) {
    steps.push('Compare this invoice against the matching one already received before paying either.')
  }
  if (has('amount_above_average')) {
    steps.push('Ask the vendor to confirm the amount against the purchase order before release.')
  }
  if (has('gstin_mismatch') || has('tax_mismatch')) {
    steps.push('Verify the tax identifiers against the GST portal.')
  }
  steps.push('Record the outcome of each check in the note before deciding.')

  const verdict =
    row.status === 'suspicious'
      ? 'Do not process automatically. Verify the vendor manually before any payment leaves.'
      : 'Hold for a second pair of eyes. Confirm the points below before approving.'

  return { verdict, steps }
}

function buildActivity(row) {
  const events = [
    {
      id: 'uploaded',
      label: 'Invoice received',
      detail: `Arrived by email from ${row.senderEmail}`,
      at: row.receivedAt,
      by: 'System',
    },
    {
      id: 'analysed',
      label: 'Analysed',
      detail: row.flags.length
        ? `${row.flags.length} ${row.flags.length === 1 ? 'check' : 'checks'} raised a flag · scored ${row.riskScore}`
        : `No checks raised a flag · scored ${row.riskScore}`,
      at: new Date(new Date(row.receivedAt).getTime() + 48000).toISOString(),
      by: 'Fraud Guardian',
    },
  ]

  const decision = decisions.get(row.id) ?? row.decision
  if (decision) {
    events.push({
      id: 'decision',
      label: DECISION_LABELS[decision.action] ?? 'Decision recorded',
      detail: decision.note || null,
      at: decision.at,
      by: decision.by,
      action: decision.action,
    })
  }

  return events.sort((a, b) => new Date(a.at) - new Date(b.at))
}

/** One invoice with everything the detail page needs, in one call. */
export async function getInvoice(id) {
  await latency()

  const row = corpus().find((item) => item.id === id)
  if (!row) throw new Error('That invoice could not be found.')

  const vendor = VENDOR_BY_ID.get(row.vendorId)
  const queue = reviewQueue()
  const index = queue.findIndex((item) => item.id === id)
  const decision = decisions.get(id) ?? row.decision

  return {
    ...row,
    decision,
    vendorRecord: {
      id: vendor.id,
      name: vendor.name,
      domain: vendor.domain,
      gstin: vendor.gstin,
      bankAccount: vendor.bankAccount,
      ifsc: vendor.ifsc,
      phoneOnRecord: vendor.phoneOnRecord,
      trusted: vendor.trusted,
    },
    recommendation: buildRecommendation(row, vendor),
    activity: buildActivity({ ...row, decision }),
    /** Recent invoices from the same vendor, for the amount-evidence chart. */
    vendorHistory: corpus()
      .filter((item) => item.vendorId === row.vendorId && item.id !== row.id)
      .sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate))
      .slice(-8)
      .map((item) => ({
        id: item.id,
        invoiceNumber: item.invoiceNumber,
        date: item.invoiceDate,
        amount: item.amount,
      })),
    queue: {
      position: index === -1 ? null : index + 1,
      total: queue.length,
      previousId: index > 0 ? queue[index - 1].id : null,
      nextId: index !== -1 && index < queue.length - 1 ? queue[index + 1].id : null,
    },
  }
}

/**
 * Record a decision on an invoice.
 *
 * Kept in memory for the session; a real endpoint would persist it and return
 * the updated row the same way.
 */
export async function decideInvoice(id, action, note = '') {
  await latency()

  if (!DECISION_LABELS[action]) throw new Error(`Unknown decision "${action}".`)
  if ((action === 'reject' || action === 'escalate') && !note.trim()) {
    throw new Error('Add a note explaining the decision.')
  }

  const row = corpus().find((item) => item.id === id)
  if (!row) throw new Error('That invoice could not be found.')

  const decision = {
    action,
    note: note.trim(),
    at: new Date().toISOString(),
    by: 'Priya Ramesh',
    label: DECISION_LABELS[action],
  }
  decisions.set(id, decision)

  const queue = reviewQueue()
  const index = queue.findIndex((item) => item.id === id)

  return {
    decision,
    activity: buildActivity({ ...row, decision }),
    nextId: index !== -1 && index < queue.length - 1 ? queue[index + 1].id : null,
  }
}

/**
 * Pretend to read a document and pull out its fields.
 *
 * `confidence` per field drives the amber "Please check" outline in the review
 * form, so a real OCR response should keep that key.
 */
export async function extractInvoice(file) {
  await latency()

  return {
    sourceName: file?.name ?? 'invoice.pdf',
    fields: {
      vendor: { value: 'Meridian Supplies Pvt Ltd', confidence: 0.97 },
      invoiceNumber: { value: 'MS/2026/0481', confidence: 0.95 },
      invoiceDate: { value: '2026-10-04', confidence: 0.93 },
      dueDate: { value: '2026-11-03', confidence: 0.71 },
      amount: { value: '486500', confidence: 0.96 },
      gstAmount: { value: '87570', confidence: 0.68 },
      gstin: { value: '27AADCM4821K1ZP', confidence: 0.94 },
      bankAccount: { value: 'XXXX XXXX 7731', confidence: 0.62 },
      ifsc: { value: 'HDFC0004512', confidence: 0.89 },
      senderEmail: { value: 'accounts@meridiansupplies.in', confidence: 0.91 },
    },
  }
}

/**
 * Score and store an invoice. Returns the saved row, so the result step can
 * show the gauge and the caller can link straight to it.
 */
export async function saveInvoice(data) {
  await latency()

  const amount = Number(String(data.amount).replace(/[^0-9.]/g, '')) || 0
  const gstAmount = Number(String(data.gstAmount).replace(/[^0-9.]/g, '')) || 0

  // A fixed outcome, so the demo always ends on a result worth looking at.
  // Points sum to the score, the same invariant the corpus holds to.
  const flags = [
    {
      id: 'bank_account_changed',
      title: 'Bank account changed',
      field: 'bankAccount',
      points: 40,
      explanation: 'This invoice asks you to pay an account that does not match the one this vendor was last paid on.',
      evidence: { kind: 'generic', detail: 'The payout account differs from the one on record.' },
    },
    {
      id: 'lookalike_domain',
      title: 'Lookalike email domain',
      field: 'senderEmail',
      points: 30,
      explanation: "The sender's domain differs from the vendor's registered domain by a single character.",
      evidence: { kind: 'generic', detail: 'Sender domain does not match the domain on record.' },
    },
    {
      id: 'amount_above_average',
      title: 'Amount above vendor average',
      field: 'amount',
      points: 17,
      explanation: "The total sits well outside this vendor's usual range.",
      evidence: { kind: 'generic', detail: 'Amount is above the vendor average.' },
    },
  ]
  const riskScore = flags.reduce((sum, flag) => sum + flag.points, 0)

  const saved = {
    id: `inv_new_${Date.now()}`,
    invoiceNumber: data.invoiceNumber || 'MS/2026/0481',
    vendor: data.vendor || 'Unknown vendor',
    senderEmail: data.senderEmail ?? '',
    invoiceDate: new Date(data.invoiceDate || Date.now()).toISOString(),
    dueDate: new Date(data.dueDate || Date.now()).toISOString(),
    receivedAt: new Date().toISOString(),
    amount,
    gstAmount,
    gstin: data.gstin ?? '',
    bankAccount: data.bankAccount ?? '',
    ifsc: data.ifsc ?? '',
    riskScore,
    status: statusForScore(riskScore),
    flags,
    mainFlag: flags[0].title,
    recommendation: {
      verdict: 'Do not process automatically. Verify the vendor manually before any payment leaves.',
      steps: [
        'Call the vendor on the number already on record — not any number in the email — and confirm the account change with a named contact.',
        'Compare the sender domain with the one on record character by character.',
        'Ask the vendor to confirm the amount against the purchase order before release.',
        'Record the outcome of each check before deciding.',
      ],
    },
  }

  sessionRows = [saved, ...sessionRows]
  return saved
}

/** Legend/tab metadata, so pages do not re-declare the band list. */
export const STATUS_TABS = [
  { key: 'all', label: 'All', band: null },
  ...BAND_ORDER.map((band) => ({ key: band.status, label: band.label, band })),
]

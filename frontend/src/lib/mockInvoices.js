/**
 * Mock invoice and vendor corpus. Deterministic — generated once from a seeded
 * PRNG so every reload shows the same data and the numbers on one screen agree
 * with the numbers on another.
 *
 * Shape matches what a real API is expected to return, so the services can swap
 * their source without the pages noticing.
 */
import { statusForScore } from './risk'

// --- deterministic PRNG (mulberry32) -----------------------------------------
function makeRandom(seed) {
  let a = seed
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = makeRandom(20260410)
const pick = (list) => list[Math.floor(rand() * list.length)]
const between = (min, max) => min + Math.floor(rand() * (max - min + 1))

/**
 * "Today" is pinned to module load, so relative times stay correct for the life
 * of the session.
 */
export const NOW = new Date()

function daysAgo(n, hour = 11) {
  const d = new Date(NOW)
  d.setDate(d.getDate() - n)
  d.setHours(hour, between(0, 59), 0, 0)
  return d
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// --- vendor master -----------------------------------------------------------
const VENDOR_SEED = [
  { name: 'ABC Technologies', domain: 'abctechnologies.in', state: '27', trusted: true },
  { name: 'Meridian Supplies Pvt Ltd', domain: 'meridiansupplies.in', state: '27', trusted: true },
  { name: 'Ashok Krishnan & Co', domain: 'ashokkrishnan.co.in', state: '33', trusted: true },
  { name: 'Navtech Infra Solutions', domain: 'navtechinfra.com', state: '29', trusted: false },
  { name: 'Saptul Logistics Pvt Ltd', domain: 'saptul.in', state: '24', trusted: true },
  { name: 'Bharat Metalworks Ltd', domain: 'bharatmetalworks.in', state: '27', trusted: true },
  { name: 'Kaveri Packaging Industries', domain: 'kaveripack.in', state: '29', trusted: false },
  { name: 'Sundaram Office Systems', domain: 'sundaramoffice.in', state: '33', trusted: true },
  { name: 'Lotus Facility Services', domain: 'lotusfacility.in', state: '07', trusted: true },
  { name: 'Deccan Freight Carriers', domain: 'deccanfreight.in', state: '36', trusted: false },
  { name: 'Raghav Electricals Pvt Ltd', domain: 'raghavelectricals.in', state: '09', trusted: true },
  { name: 'Indus Valley Textiles', domain: 'indusvalleytex.com', state: '08', trusted: false },
  { name: 'Prakash Hardware Stores', domain: 'prakashhardware.in', state: '27', trusted: true },
  { name: 'Vertex Software Labs', domain: 'vertexlabs.io', state: '29', trusted: false },
  { name: 'Ganga Chemicals Ltd', domain: 'gangachem.in', state: '19', trusted: true },
  { name: 'Nilgiri Catering Services', domain: 'nilgiricatering.in', state: '33', trusted: true },
  { name: 'Orbit Print & Media', domain: 'orbitprint.in', state: '07', trusted: false },
  { name: 'Shakti Power Systems', domain: 'shaktipower.in', state: '24', trusted: true },
  { name: 'Coastal Marine Supplies', domain: 'coastalmarine.in', state: '32', trusted: true },
]

const GST_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const BANK_CODES = ['HDFC', 'ICIC', 'SBIN', 'UTIB', 'KKBK', 'PUNB', 'IDFB', 'YESB']

/** 15-char GSTIN: 2 state digits, 10-char PAN, entity digit, 'Z', checksum char. */
function makeGstin(stateCode) {
  const pan =
    Array.from({ length: 5 }, () => pick([...GST_LETTERS])).join('') +
    String(between(1000, 9999)) +
    pick([...GST_LETTERS])
  return `${stateCode}${pan}${between(1, 9)}Z${pick([...GST_LETTERS])}`
}

/** 11-char IFSC: 4 bank letters, '0', 6 branch chars. */
function makeIfsc() {
  return `${pick(BANK_CODES)}0${String(between(100000, 999999))}`
}

/** Full account numbers live here; the UI masks them by default. */
function makeAccount() {
  return `${between(10, 99)}${between(100000, 999999)}${between(1000, 9999)}`
}

/** A one-character typo of a domain — the lookalike the product exists to catch. */
function lookalikeDomain(domain) {
  const [name, ...rest] = domain.split('.')
  // Drop a letter from the middle: "abctechnologies" -> "abctechnolgies"
  const at = Math.floor(name.length / 2) + 1
  return [name.slice(0, at) + name.slice(at + 1), ...rest].join('.')
}

const VENDORS = VENDOR_SEED.map((seed, i) => {
  const firstSeen = daysAgo(between(70, 900))
  return {
    id: `ven_${String(i + 1).padStart(3, '0')}`,
    name: seed.name,
    domain: seed.domain,
    gstin: makeGstin(seed.state),
    trusted: seed.trusted,
    firstSeen: firstSeen.toISOString(),
    bankAccount: makeAccount(),
    ifsc: makeIfsc(),
    phoneOnRecord: `+91 ${between(70, 99)}${between(10000000, 99999999)}`,
    bankChanges: [],
  }
})

const VENDOR_BY_ID = new Map(VENDORS.map((v) => [v.id, v]))
const VENDOR_BY_NAME = new Map(VENDORS.map((v) => [v.name, v]))

const ABC = VENDOR_BY_NAME.get('ABC Technologies')
// Fixed so the flagship invoice's evidence always reads the same.
ABC.gstin = '27AABCA1234K1Z5'
ABC.bankAccount = '50100294817732'
ABC.ifsc = 'HDFC0004512'
ABC.phoneOnRecord = '+91 9845012233'
ABC.firstSeen = daysAgo(640).toISOString()

/** The account the fraudster substituted on the flagship invoice. */
const ABC_FRAUD_ACCOUNT = '91847263510094'

// --- bank-change history -----------------------------------------------------
// A few vendors changed details recently; one of them is the flagship case.
function buildBankChanges() {
  ABC.bankChanges = [
    {
      id: 'bc_abc_1',
      from: '50100294817732',
      to: ABC_FRAUD_ACCOUNT,
      ifscFrom: 'HDFC0004512',
      ifscTo: 'KKBK0007781',
      changedOn: daysAgo(2).toISOString(),
      verified: false,
      source: 'Invoice ABC/2026/0914',
    },
    {
      id: 'bc_abc_0',
      from: '50100288110045',
      to: '50100294817732',
      ifscFrom: 'HDFC0001188',
      ifscTo: 'HDFC0004512',
      changedOn: daysAgo(410).toISOString(),
      verified: true,
      source: 'Confirmed by phone with A. Rao',
    },
  ]

  for (const vendor of VENDORS) {
    if (vendor.id === ABC.id) continue
    const changeCount = rand() < 0.35 ? between(1, 2) : 0
    let previous = makeAccount()

    for (let i = 0; i < changeCount; i += 1) {
      const recent = i === changeCount - 1 && rand() < 0.3
      const next = i === changeCount - 1 ? vendor.bankAccount : makeAccount()
      vendor.bankChanges.push({
        id: `bc_${vendor.id}_${i}`,
        from: previous,
        to: next,
        ifscFrom: makeIfsc(),
        ifscTo: vendor.ifsc,
        changedOn: daysAgo(recent ? between(3, 28) : between(60, 500)).toISOString(),
        verified: rand() < 0.75,
        source: rand() < 0.5 ? 'Confirmed by phone' : 'Vendor portal update',
      })
      previous = next
    }
    // Newest first.
    vendor.bankChanges.sort((a, b) => new Date(b.changedOn) - new Date(a.changedOn))
  }
}
buildBankChanges()

// --- flag catalogue ----------------------------------------------------------
/**
 * Every flag carries a title, a plain explanation, a points value and the
 * evidence behind it. `field` names the invoice field to outline on the
 * document preview.
 */
const FLAG_TYPES = [
  {
    id: 'bank_account_changed',
    title: 'Bank account changed',
    field: 'bankAccount',
    weight: 5,
    build: (ctx) => ({
      explanation: `This invoice asks you to pay an account that does not match the one ${ctx.vendor.name} was last paid on.`,
      evidence: {
        kind: 'bank',
        onRecord: ctx.vendor.bankAccount,
        onInvoice: ctx.invoice.bankAccount,
        ifscOnRecord: ctx.vendor.ifsc,
        ifscOnInvoice: ctx.invoice.ifsc,
        changedOn: ctx.vendor.bankChanges[0]?.changedOn ?? null,
      },
    }),
  },
  {
    id: 'lookalike_domain',
    title: 'Lookalike email domain',
    field: 'senderEmail',
    weight: 4,
    build: (ctx) => ({
      explanation: `The sender's domain differs from ${ctx.vendor.name}'s registered domain by a single character.`,
      evidence: {
        kind: 'domain',
        onRecord: ctx.vendor.domain,
        onInvoice: ctx.invoice.senderEmail.split('@')[1] ?? '',
      },
    }),
  },
  {
    id: 'amount_above_average',
    title: 'Amount above vendor average',
    field: 'amount',
    weight: 3,
    build: (ctx) => ({
      explanation: `At ${Math.round(ctx.percentAbove)}% above this vendor's average invoice, the total is outside their usual range.`,
      evidence: {
        kind: 'amount',
        amount: ctx.invoice.amount,
        date: ctx.invoice.invoiceDate,
        average: ctx.vendorAverage,
        percentAbove: ctx.percentAbove,
      },
    }),
  },
  {
    id: 'duplicate_invoice',
    title: 'Duplicate invoice',
    field: 'invoiceNumber',
    weight: 4,
    build: (ctx) => ({
      explanation: 'An invoice with the same vendor and total has already been received this month.',
      evidence: { kind: 'duplicate', match: ctx.duplicate },
    }),
  },
  {
    id: 'new_vendor',
    title: 'New vendor, no history',
    field: 'vendor',
    weight: 3,
    build: (ctx) => ({
      explanation: `${ctx.vendor.name} has no settled invoices on file, so there is nothing to compare this request against.`,
      evidence: { kind: 'generic', detail: 'No prior payments recorded for this vendor.' },
    }),
  },
  {
    id: 'gstin_mismatch',
    title: 'GSTIN mismatch',
    field: 'gstin',
    weight: 3,
    build: (ctx) => ({
      explanation: 'The GSTIN on this invoice does not match the one recorded against the vendor.',
      evidence: {
        kind: 'pair',
        label: 'GSTIN',
        onRecord: ctx.vendor.gstin,
        onInvoice: ctx.invoice.gstin,
      },
    }),
  },
  {
    id: 'urgency_pressure',
    title: 'Urgent payment pressure',
    field: 'dueDate',
    weight: 2,
    build: () => ({
      explanation: 'The request pushes for same-day payment, a common tactic to skip normal checks.',
      evidence: { kind: 'generic', detail: '"Please process today" appears in the covering email.' },
    }),
  },
  {
    id: 'tax_mismatch',
    title: 'Tax total does not reconcile',
    field: 'gstAmount',
    weight: 2,
    build: (ctx) => ({
      explanation: 'The GST shown does not match any standard rate applied to the invoice total.',
      evidence: {
        kind: 'pair',
        label: 'GST',
        onRecord: `18% would be ₹${Math.round(ctx.invoice.amount * 0.18)}`,
        onInvoice: `₹${ctx.invoice.gstAmount} on the invoice`,
      },
    }),
  },
  {
    id: 'ifsc_changed',
    title: 'IFSC changed since last payment',
    field: 'ifsc',
    weight: 3,
    build: (ctx) => ({
      explanation: 'The branch code differs from the one used for the last settled payment.',
      evidence: {
        kind: 'pair',
        label: 'IFSC',
        onRecord: ctx.vendor.ifsc,
        onInvoice: ctx.invoice.ifsc,
      },
    }),
  },
]

const FLAG_BY_ID = new Map(FLAG_TYPES.map((f) => [f.id, f]))

/** Observations mild enough to appear on an invoice that still clears. */
const MINOR_FLAG_IDS = ['new_vendor', 'urgency_pressure', 'ifsc_changed']

/**
 * Split `total` into `n` positive integers that sum to exactly `total`, so a
 * flag breakdown can never disagree with the risk score it explains.
 */
function distribute(total, n) {
  if (n <= 1) return [total]
  const parts = []
  let remaining = total

  for (let i = 0; i < n - 1; i += 1) {
    const mustLeave = n - 1 - i // at least 1 point for each flag still to come
    const share = Math.max(1, Math.min(remaining - mustLeave, Math.round(remaining / (n - i))))
    parts.push(share)
    remaining -= share
  }
  parts.push(remaining)
  return parts
}

function buildFlags(ids, score, ctx) {
  const points = distribute(score, ids.length)
  return ids
    .map((id, i) => {
      const type = FLAG_BY_ID.get(id)
      return {
        id: type.id,
        title: type.title,
        field: type.field,
        points: points[i],
        ...type.build(ctx),
      }
    })
    .sort((a, b) => b.points - a.points)
}

// --- invoices ----------------------------------------------------------------
const INVOICE_PREFIXES = ['INV', 'MS', 'AK', 'NVT', 'SPL', 'BMW', 'KP', 'SOS']

function buildInvoices(count) {
  const rows = []

  for (let i = 0; i < count; i += 1) {
    const vendor = pick(VENDORS.filter((v) => v.id !== ABC.id))

    const ago = rand() < 0.45 ? between(0, 6) : between(0, 29)
    const received = daysAgo(ago, between(8, 19))
    if (received > NOW) received.setTime(NOW.getTime() - between(2, 50) * 60000)

    const invoiceDate = startOfDay(received)
    const dueDate = new Date(invoiceDate)
    dueDate.setDate(dueDate.getDate() + pick([15, 30, 30, 45, 60]))

    // The score is the sum of what the flags found, so a breakdown can never
    // disagree with the number it explains. Most invoices find nothing.
    const roll = rand()
    let score
    let flagCount
    if (roll < 0.62) {
      // Clean, or one mild observation worth a handful of points.
      const minor = rand() < 0.45
      score = minor ? between(4, 30) : 0
      flagCount = minor ? 1 : 0
    } else if (roll < 0.85) {
      score = between(31, 60)
      flagCount = between(1, 2)
    } else {
      score = between(61, 97)
      flagCount = between(2, 3)
    }
    const status = statusForScore(score)

    const amount = between(8, 1200) * 500
    const gstAmount = Math.round(amount * pick([0.05, 0.12, 0.18]))

    const pool = status === 'normal' ? MINOR_FLAG_IDS : FLAG_TYPES.map((t) => t.id)
    const chosen = []
    while (chosen.length < flagCount) {
      const id = pick(pool)
      // A duplicate flag needs a real match, which is resolved later.
      if (id !== 'duplicate_invoice' && !chosen.includes(id)) chosen.push(id)
    }

    const impersonated = chosen.includes('lookalike_domain')
    const domain = impersonated ? lookalikeDomain(vendor.domain) : vendor.domain
    const bankChanged = chosen.includes('bank_account_changed')

    rows.push({
      id: `inv_${String(i + 1).padStart(3, '0')}`,
      invoiceNumber: `${pick(INVOICE_PREFIXES)}/${received.getFullYear()}/${String(between(100, 9999)).padStart(4, '0')}`,
      vendorId: vendor.id,
      vendor: vendor.name,
      senderEmail: `accounts@${domain}`,
      invoiceDate: invoiceDate.toISOString(),
      dueDate: dueDate.toISOString(),
      receivedAt: received.toISOString(),
      amount,
      gstAmount,
      gstin: chosen.includes('gstin_mismatch') ? makeGstin(vendor.gstin.slice(0, 2)) : vendor.gstin,
      bankAccount: bankChanged ? makeAccount() : vendor.bankAccount,
      ifsc: chosen.includes('ifsc_changed') ? makeIfsc() : vendor.ifsc,
      riskScore: score,
      status,
      _flagIds: chosen,
      decision: null,
    })
  }

  return rows
}

/** The flagship demo invoice: hand-authored so the evidence is exact. */
function buildFlagshipInvoice() {
  const received = daysAgo(0, 9)
  received.setMinutes(42)
  const invoiceDate = startOfDay(daysAgo(1))
  const dueDate = new Date(invoiceDate)
  dueDate.setDate(dueDate.getDate() + 7)

  return {
    id: 'inv_abc_001',
    invoiceNumber: 'ABC/2026/0914',
    vendorId: ABC.id,
    vendor: ABC.name,
    senderEmail: `accounts@${lookalikeDomain(ABC.domain)}`,
    invoiceDate: invoiceDate.toISOString(),
    dueDate: dueDate.toISOString(),
    receivedAt: received.toISOString(),
    amount: 486500,
    gstAmount: 87570,
    gstin: ABC.gstin,
    bankAccount: ABC_FRAUD_ACCOUNT,
    ifsc: 'KKBK0007781',
    riskScore: 87,
    status: statusForScore(87),
    // Exactly the three flags the demo calls for: 40 + 30 + 17 = 87.
    _fixedFlags: [
      { id: 'bank_account_changed', points: 40 },
      { id: 'lookalike_domain', points: 30 },
      { id: 'amount_above_average', points: 17 },
    ],
    decision: null,
  }
}

/** ABC's settled history, so the average the flagship is measured against is real. */
function buildAbcHistory() {
  const amounts = [312000, 298500, 341000, 365000, 327500, 352000, 318000, 338500]
  return amounts.map((amount, i) => {
    const received = daysAgo(24 + i * 26, 12)
    const invoiceDate = startOfDay(received)
    const dueDate = new Date(invoiceDate)
    dueDate.setDate(dueDate.getDate() + 30)
    return {
      id: `inv_abc_h${String(i + 1).padStart(2, '0')}`,
      invoiceNumber: `ABC/2026/0${820 - i * 11}`,
      vendorId: ABC.id,
      vendor: ABC.name,
      senderEmail: `accounts@${ABC.domain}`,
      invoiceDate: invoiceDate.toISOString(),
      dueDate: dueDate.toISOString(),
      receivedAt: received.toISOString(),
      amount,
      gstAmount: Math.round(amount * 0.18),
      gstin: ABC.gstin,
      bankAccount: '50100294817732',
      ifsc: 'HDFC0004512',
      riskScore: 0,
      status: statusForScore(0),
      _flagIds: [],
      decision: { action: 'approve', at: new Date(received.getTime() + 36e5).toISOString(), by: 'Priya Ramesh' },
    }
  })
}

const RAW = [buildFlagshipInvoice(), ...buildAbcHistory(), ...buildInvoices(40)]

// --- derive per-vendor aggregates, then resolve every flag --------------------
const byVendor = new Map()
for (const row of RAW) {
  if (!byVendor.has(row.vendorId)) byVendor.set(row.vendorId, [])
  byVendor.get(row.vendorId).push(row)
}

/** The average a flagged invoice is compared against excludes itself. */
function averageExcluding(vendorId, invoiceId) {
  const peers = (byVendor.get(vendorId) ?? []).filter((r) => r.id !== invoiceId)
  if (!peers.length) return 0
  return Math.round(peers.reduce((sum, r) => sum + r.amount, 0) / peers.length)
}

const INVOICES = RAW.map((row) => {
  const vendor = VENDOR_BY_ID.get(row.vendorId)
  const vendorAverage = averageExcluding(row.vendorId, row.id)
  const percentAbove = vendorAverage ? ((row.amount - vendorAverage) / vendorAverage) * 100 : 0

  // A duplicate flag needs a real invoice to point at.
  const duplicateOf = (byVendor.get(row.vendorId) ?? []).find(
    (r) => r.id !== row.id && Math.abs(r.amount - row.amount) < 1,
  )

  const ctx = { invoice: row, vendor, vendorAverage, percentAbove, duplicate: duplicateOf ?? null }

  let flags
  if (row._fixedFlags) {
    flags = row._fixedFlags.map(({ id, points }) => {
      const type = FLAG_BY_ID.get(id)
      return { id, title: type.title, field: type.field, points, ...type.build(ctx) }
    })
  } else {
    const ids = row._flagIds.filter((id) => id !== 'duplicate_invoice' || duplicateOf)
    flags = ids.length ? buildFlags(ids, row.riskScore, ctx) : []
  }

  const { _flagIds, _fixedFlags, ...rest } = row
  return {
    ...rest,
    vendorDomain: vendor.domain,
    vendorAverage,
    percentAbove,
    flags,
    mainFlag: flags[0]?.title ?? null,
  }
})

// Newest first — the order every screen starts from.
INVOICES.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))

export { INVOICES, VENDORS, VENDOR_BY_ID, FLAG_TYPES, lookalikeDomain }

export const ALL_FLAGS = FLAG_TYPES.map((f) => f.title)

/** The flagship invoice's id, so the demo can be linked to directly. */
export const FLAGSHIP_INVOICE_ID = 'inv_abc_001'

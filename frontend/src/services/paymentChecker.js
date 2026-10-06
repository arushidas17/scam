/**
 * Mock payment-request analyser.
 *
 * Unlike the other mocks this one really reads its input: the phrase lists,
 * patterns and domain comparison below are simple but genuine, so two different
 * emails produce two different reports. A real backend swaps the body of
 * analysePaymentRequest and keeps the same return shape.
 */
import { VENDORS, lookalikeDomain } from '../lib/mockInvoices'
import { statusForScore } from '../lib/risk'

const MIN_MS = 400
const MAX_MS = 900

function latency() {
  return new Promise((resolve) => setTimeout(resolve, MIN_MS + Math.random() * (MAX_MS - MIN_MS)))
}

// --- phrase lists ------------------------------------------------------------
const PHRASES = {
  urgency: {
    kind: 'urgency',
    reason: 'Pressure to pay quickly is used to push a request past the normal checks.',
    terms: [
      'urgent', 'urgently', 'immediately', 'right away', 'as soon as possible', 'asap',
      'today itself', 'before close of business', 'by end of day', 'time sensitive',
      'time-sensitive', 'expedite', 'cannot wait', 'last reminder', 'final notice',
      'process today', 'same day',
    ],
  },
  secrecy: {
    kind: 'secrecy',
    reason: 'A request to keep a payment quiet is meant to stop you verifying it with anyone else.',
    terms: [
      'confidential', 'strictly confidential', 'do not discuss', 'keep this between',
      'discreet', 'discretion', 'do not inform', 'without involving', 'only you',
      'no need to inform',
    ],
  },
  newAccount: {
    kind: 'account',
    reason: 'A change of payout details is the single most common invoice-fraud tactic.',
    terms: [
      'new bank', 'new account', 'updated bank', 'updated account', 'changed our bank',
      'change our bank', 'bank details have changed', 'account details have changed',
      'revised bank', 'new beneficiary', 'kindly update', 'update our records',
      'remit to', 'wire to',
    ],
  },
}

const ACCOUNT_RE = /\b\d[\d\s-]{8,22}\d\b/g
const IFSC_RE = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g

// --- helpers -----------------------------------------------------------------
function domainOf(email) {
  const match = String(email).trim().toLowerCase().match(/@([^\s>]+)$/)
  return match ? match[1] : ''
}

/** Levenshtein, capped — only used on short domain strings. */
function editDistance(a, b) {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j]
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      diagonal = temp
    }
  }
  return prev[b.length]
}

/**
 * Find every phrase match with its position, so the UI can highlight the email
 * in place. Overlapping matches are dropped, longest first.
 */
function findPhrases(body) {
  const lower = body.toLowerCase()
  const hits = []

  for (const group of Object.values(PHRASES)) {
    for (const term of group.terms) {
      let from = 0
      let at = lower.indexOf(term, from)
      while (at !== -1) {
        hits.push({ start: at, end: at + term.length, kind: group.kind, reason: group.reason, text: body.slice(at, at + term.length) })
        from = at + term.length
        at = lower.indexOf(term, from)
      }
    }
  }

  hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))

  const kept = []
  for (const hit of hits) {
    if (!kept.some((k) => hit.start < k.end && k.start < hit.end)) kept.push(hit)
  }
  return kept.sort((a, b) => a.start - b.start)
}

function findPattern(body, regex, kind, reason) {
  const hits = []
  let match
  const re = new RegExp(regex.source, regex.flags)
  while ((match = re.exec(body)) !== null) {
    const text = match[0]
    // An account number is a long run of digits, not a date or an amount.
    if (kind === 'account' && text.replace(/\D/g, '').length < 9) continue
    hits.push({ start: match.index, end: match.index + text.length, kind, reason, text })
  }
  return hits
}

function flag(id, title, points, explanation, evidence, field = null) {
  return { id, title, points, explanation, evidence, field }
}

// --- the analyser ------------------------------------------------------------
export async function analysePaymentRequest({ from = '', subject = '', body = '' } = {}) {
  await latency()

  if (!from.trim() || !body.trim()) {
    throw new Error('Add the sender address and the message body before analysing.')
  }

  const senderDomain = domainOf(from)
  const text = `${subject}\n${body}`

  // --- who is this claiming to be? -----------------------------------------
  const exact = VENDORS.find((v) => v.domain.toLowerCase() === senderDomain)
  let lookalike = null
  if (!exact && senderDomain) {
    lookalike = VENDORS.find((v) => {
      const d = v.domain.toLowerCase()
      return d !== senderDomain && editDistance(d, senderDomain) <= 2
    })
  }
  // Fall back to a name mentioned in the text, so an unknown domain still
  // tells us who is being impersonated.
  const named = VENDORS.find((v) => text.toLowerCase().includes(v.name.toLowerCase()))
  const vendor = exact ?? lookalike ?? named ?? null

  // --- what did we find? ----------------------------------------------------
  const phraseHits = findPhrases(text)
  const accountHits = findPattern(
    text,
    ACCOUNT_RE,
    'account',
    'A bank account number in the message body means this request moves money somewhere new.',
  )
  const ifscHits = findPattern(
    text,
    IFSC_RE,
    'ifsc',
    'An IFSC code names the destination branch — check it against the one on record.',
  )

  const highlights = [...phraseHits, ...accountHits, ...ifscHits]
    .sort((a, b) => a.start - b.start)
    .filter((hit, i, all) => i === 0 || hit.start >= all[i - 1].end)

  const counts = {
    urgency: highlights.filter((h) => h.kind === 'urgency').length,
    secrecy: highlights.filter((h) => h.kind === 'secrecy').length,
    account: highlights.filter((h) => h.kind === 'account').length,
    ifsc: highlights.filter((h) => h.kind === 'ifsc').length,
  }
  const accountNumbers = highlights.filter((h) => h.kind === 'account').map((h) => h.text.replace(/\D/g, ''))
  const ifscCodes = highlights.filter((h) => h.kind === 'ifsc').map((h) => h.text)

  const mentionsNewAccount = phraseHits.some(
    (h) => h.kind === 'account' || PHRASES.newAccount.terms.some((t) => h.text.toLowerCase() === t),
  )

  // --- request type ---------------------------------------------------------
  let requestType = 'General enquiry'
  if (accountNumbers.length || ifscCodes.length || mentionsNewAccount) {
    requestType = 'Bank detail change'
  } else if (/\b(invoice|payment|remit|transfer|pay)\b/i.test(text)) {
    requestType = 'Payment request'
  }

  // --- flags ----------------------------------------------------------------
  const flags = []

  if (lookalike) {
    flags.push(
      flag(
        'lookalike_domain',
        'Lookalike sender domain',
        35,
        `The sender's domain differs from ${lookalike.name}'s registered domain by a very small number of characters.`,
        { kind: 'domain', onRecord: lookalike.domain, onInvoice: senderDomain },
      ),
    )
  } else if (!exact && senderDomain) {
    flags.push(
      flag(
        'unknown_domain',
        'Unrecognised sender domain',
        18,
        `${senderDomain} does not match any vendor domain on record.`,
        { kind: 'generic', detail: 'No vendor is registered against this domain.' },
      ),
    )
  }

  if (accountNumbers.length) {
    const onRecord = vendor?.bankAccount ?? null
    const changed = onRecord && !accountNumbers.some((n) => n === onRecord)
    flags.push(
      flag(
        'new_bank_account',
        changed ? 'Bank account differs from record' : 'Bank account supplied in message',
        changed ? 30 : 14,
        changed
          ? `The account in this message is not the one ${vendor.name} was last paid on.`
          : 'The message supplies payout details directly, which should always be confirmed out of band.',
        onRecord
          ? { kind: 'bank', onRecord, onInvoice: accountNumbers[0], ifscOnRecord: vendor.ifsc, ifscOnInvoice: ifscCodes[0] ?? null, changedOn: null }
          : { kind: 'generic', detail: `Account ending ${accountNumbers[0].slice(-4)} supplied in the message.` },
      ),
    )
  }

  if (counts.urgency) {
    flags.push(
      flag(
        'urgency_pressure',
        'Urgency pressure',
        Math.min(18, 8 + counts.urgency * 4),
        `${counts.urgency} ${counts.urgency === 1 ? 'phrase pushes' : 'phrases push'} for immediate payment.`,
        { kind: 'generic', detail: highlights.filter((h) => h.kind === 'urgency').map((h) => `"${h.text}"`).join(', ') },
      ),
    )
  }

  if (counts.secrecy) {
    flags.push(
      flag(
        'secrecy',
        'Request for secrecy',
        Math.min(16, 8 + counts.secrecy * 4),
        'The message discourages you from discussing or verifying the request.',
        { kind: 'generic', detail: highlights.filter((h) => h.kind === 'secrecy').map((h) => `"${h.text}"`).join(', ') },
      ),
    )
  }

  if (ifscCodes.length && vendor && !ifscCodes.includes(vendor.ifsc)) {
    flags.push(
      flag(
        'ifsc_changed',
        'IFSC differs from record',
        10,
        'The branch code points somewhere other than the branch used for the last settled payment.',
        { kind: 'pair', label: 'IFSC', onRecord: vendor.ifsc, onInvoice: ifscCodes[0] },
      ),
    )
  }

  // --- score ----------------------------------------------------------------
  // The score is the sum of what was found, capped at 100; the cap is absorbed
  // proportionally so the breakdown still adds up to the number shown.
  const raw = flags.reduce((sum, f) => sum + f.points, 0)
  if (raw > 100) {
    let assigned = 0
    flags.forEach((f, i) => {
      const scaled = i === flags.length - 1 ? 100 - assigned : Math.max(1, Math.round((f.points / raw) * 100))
      f.points = scaled
      assigned += scaled
    })
  }
  const riskScore = Math.min(100, raw)
  const status = statusForScore(riskScore)
  flags.sort((a, b) => b.points - a.points)

  // --- recommendation -------------------------------------------------------
  const checklist = []
  if (vendor) {
    checklist.push(`Call ${vendor.name} on ${vendor.phoneOnRecord} — the number on record, not any number in this email.`)
  } else {
    checklist.push('Find the vendor in your own records and call the number held there, not one from this email.')
  }
  if (lookalike) checklist.push(`Compare the sender domain with ${lookalike.domain} character by character.`)
  if (accountNumbers.length) checklist.push('Ask the named contact to confirm the account number and IFSC out loud.')
  checklist.push('Start a new email to the address on record rather than replying to this one.')
  checklist.push('Record who confirmed the change, and when, before any payment is released.')

  const verdict =
    status === 'suspicious'
      ? 'Do not act on this message. Verify the vendor manually before changing any payment details.'
      : status === 'needs_review'
        ? 'Treat this as unverified. Confirm the details with the vendor before acting.'
        : 'Nothing in this message matches a known fraud pattern, but confirm anything that moves money.'

  return {
    riskScore,
    status,
    requestType,
    senderDomain,
    matchedVendor: vendor
      ? {
          id: vendor.id,
          name: vendor.name,
          domain: vendor.domain,
          bankAccount: vendor.bankAccount,
          ifsc: vendor.ifsc,
          phoneOnRecord: vendor.phoneOnRecord,
          exactMatch: !!exact,
        }
      : null,
    flags,
    highlights,
    text,
    recommendation: { verdict, steps: checklist },
  }
}

/** A realistic bank-change request from the ABC Technologies lookalike domain. */
export function sampleRequest() {
  const abc = VENDORS.find((v) => v.name === 'ABC Technologies')
  return {
    from: `rajesh.kumar@${lookalikeDomain(abc.domain)}`,
    subject: 'URGENT: Updated bank details for invoice ABC/2026/0914',
    body: `Dear Accounts Team,

I hope this message finds you well. Please note that we have changed our bank on account of an internal restructuring, and all future remittances must go to the new account below.

Account name: ABC Technologies
New account number: 9184 7263 5100 94
IFSC: KKBK0007781

Kindly update our records and process invoice ABC/2026/0914 for Rs. 4,86,500 today itself, as our quarter closes before end of day and the old account has already been shut.

I would request you to keep this strictly confidential until our announcement next week, and there is no need to inform the wider procurement team at this stage.

Please confirm once the transfer is done.

Best regards,
Rajesh Kumar
Finance Manager, ABC Technologies`,
  }
}

/** A harmless message, for comparison. */
export function benignRequest() {
  const abc = VENDORS.find((v) => v.name === 'ABC Technologies')
  return {
    from: `accounts@${abc.domain}`,
    subject: 'Invoice ABC/2026/0820 — payment confirmation',
    body: `Hello,

Thank you for settling invoice ABC/2026/0820 last week. Our accounts team has matched the receipt against our ledger and everything reconciles.

The next invoice for this quarter's support retainer will reach you in the usual cycle. No change to any of our details.

Do let us know if you need a copy of the GST summary for your records.

Kind regards,
Anita Rao
Accounts Receivable, ABC Technologies`,
  }
}

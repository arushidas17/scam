/**
 * The three risk bands. These are the ONLY place red, amber and green are
 * allowed to come from, so a colour on screen always carries risk meaning.
 *
 * Every band also names an icon, because status must never be carried by
 * colour alone — colour, icon and text label always travel together.
 */
import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react'

export const RISK_BANDS = {
  normal: {
    id: 'normal',
    /** The value used in the URL, the API and the mock data. */
    status: 'normal',
    label: 'Normal',
    icon: ShieldCheck,
    text: 'text-risk-normal',
    stroke: 'stroke-risk-normal',
    bg: 'bg-risk-normal-dim',
    border: 'border-risk-normal-edge',
    dot: 'bg-risk-normal',
    bar: 'bg-risk-normal',
    hex: '#2CE69B',
  },
  review: {
    id: 'review',
    status: 'needs_review',
    label: 'Needs Review',
    icon: AlertTriangle,
    text: 'text-risk-review',
    stroke: 'stroke-risk-review',
    bg: 'bg-risk-review-dim',
    border: 'border-risk-review-edge',
    dot: 'bg-risk-review',
    bar: 'bg-risk-review',
    hex: '#FFB224',
  },
  suspicious: {
    id: 'suspicious',
    status: 'suspicious',
    label: 'Suspicious',
    icon: ShieldAlert,
    text: 'text-risk-suspicious',
    stroke: 'stroke-risk-suspicious',
    bg: 'bg-risk-suspicious-dim',
    border: 'border-risk-suspicious-edge',
    dot: 'bg-risk-suspicious',
    bar: 'bg-risk-suspicious',
    hex: '#FF4D5E',
  },
}

/** Band order, low risk first — used by charts, legends and filter tabs. */
export const BAND_ORDER = [RISK_BANDS.normal, RISK_BANDS.review, RISK_BANDS.suspicious]

/**
 * 0–100 score to a band.
 * Normal 0–30 · Needs Review 31–60 · Suspicious 61–100.
 */
export function bandForScore(score) {
  if (score >= 61) return RISK_BANDS.suspicious
  if (score >= 31) return RISK_BANDS.review
  return RISK_BANDS.normal
}

/** Status string ("needs_review") to band. */
export function bandForStatus(status) {
  return BAND_ORDER.find((band) => band.status === status) ?? RISK_BANDS.normal
}

/** The status string a score maps to, for the mock data and URL filters. */
export function statusForScore(score) {
  return bandForScore(score).status
}

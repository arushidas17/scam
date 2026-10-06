/** Indian digit grouping: ₹8,42,000 rather than ₹842,000. */
export function formatINR(value, { withSymbol = true } = {}) {
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(value))
  return withSymbol ? `₹${formatted}` : formatted
}

export function formatCount(value) {
  return new Intl.NumberFormat('en-IN').format(Math.round(value))
}

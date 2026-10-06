/** Last four digits only, which is how an account number should read by default. */
export function maskAccount(value) {
  if (!value) return '\u2014'
  const digits = String(value).replace(/\D/g, '')
  if (digits.length <= 4) return digits
  return `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${digits.slice(-4)}`
}

/** Group a full account number for readability once it is revealed. */
export function groupDigits(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

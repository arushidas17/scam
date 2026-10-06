/** Split two strings into the shared head, the differing middle, and the shared tail. */
export function diffSegments(a = '', b = '') {
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1

  let tail = 0
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail += 1
  }

  return {
    a: { head: a.slice(0, head), middle: a.slice(head, a.length - tail), tail: a.slice(a.length - tail) },
    b: { head: b.slice(0, head), middle: b.slice(head, b.length - tail), tail: b.slice(b.length - tail) },
    identical: a === b,
  }
}

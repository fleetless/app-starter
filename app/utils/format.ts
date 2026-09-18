/** `decimals` is the datapoint's own `numeric.decimals`, an exact digit count; without one, at most three places. */
export function formatValue(value: unknown, decimals: number | null): string {
  if (typeof value === 'number') {
    const options: Intl.NumberFormatOptions = decimals === null
      ? { maximumFractionDigits: 3 }
      : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    // NaN and the infinities have no locale form worth showing; say them plainly.
    return Number.isFinite(value) ? value.toLocaleString('en-US', options) : String(value)
  }
  if (typeof value === 'string' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

/** How long ago, coarse on purpose: a card says "stale", not a stopwatch reading. */
export function formatAge(ms: number): string {
  if (ms < 1_000) return 'now'
  if (ms < 60_000) return `${Math.floor(ms / 1_000)} s ago`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`
  return `${Math.floor(ms / 3_600_000)} h ago`
}

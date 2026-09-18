import { describe, expect, it } from 'vitest'
import { formatAge, formatValue } from '~/utils/format'

describe('formatValue', () => {
  it('shows exactly the digits the datapoint asked for, and at most three otherwise', () => {
    expect(formatValue(18, 1)).toBe('18.0')
    expect(formatValue(0.123456, null)).toBe('0.123')
    expect(formatValue(7, 0)).toBe('7')
  })

  it('passes strings and booleans through and serialises the rest', () => {
    expect(formatValue('docked', null)).toBe('docked')
    expect(formatValue(true, null)).toBe('true')
    expect(formatValue({ x: 1 }, null)).toBe('{"x":1}')
  })
})

describe('formatAge', () => {
  it('reads as seconds, then minutes, then hours', () => {
    expect(formatAge(800)).toBe('now')
    expect(formatAge(4_000)).toBe('4 s ago')
    expect(formatAge(150_000)).toBe('2 min ago')
    expect(formatAge(7_200_000)).toBe('2 h ago')
  })
})

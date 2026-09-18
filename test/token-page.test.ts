import { describe, expect, it } from 'vitest'
import { FleetlessError } from '@fleetless/sdk'
import { outcomeOf } from '~/composables/useTokenPage'

describe('outcomeOf', () => {
  it('is spent for token_spent, failed for anything else', () => {
    expect(outcomeOf(new FleetlessError('token_spent', 'x', { status: 410 }))).toBe('spent')
    expect(outcomeOf(new FleetlessError('rate_limited', 'x'))).toBe('failed')
    expect(outcomeOf(new Error('x'))).toBe('failed')
  })
})

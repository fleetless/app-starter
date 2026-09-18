import { describe, expect, it } from 'vitest'
import { FleetlessError } from '@fleetless/sdk'
import { fieldErrorsFrom, isSignedOut, sentenceFor } from '~/utils/errors'

describe('sentenceFor', () => {
  it('says one sentence for invalid_credentials, whatever the cause', () => {
    expect(sentenceFor(new FleetlessError('invalid_credentials', 'nope', { status: 401 }))).toBe('That email and password do not match.')
  })

  it('names the wait for rate_limited from its one number', () => {
    expect(sentenceFor(new FleetlessError('rate_limited', 'slow down', { status: 429, details: { retry_after_ms: 4200 } }))).toBe('Too many attempts. Try again in 5 seconds.')
  })

  it('names the console setting a target_state_conflict is about', () => {
    const error = new FleetlessError('target_state_conflict', 'unset', { status: 409, details: { fields: [{ field: 'default_role_id', rule: 'not_set', message: 'x' }] } })
    expect(sentenceFor(error)).toBe('The app is not set up for this yet: default_role_id is missing in the console.')
  })

  it('falls back to what did not happen, never to the server message', () => {
    expect(sentenceFor(new Error('ECONNREFUSED'))).toBe('The request did not go through.')
    expect(sentenceFor(new FleetlessError('some_new_code', 'server text'))).toBe('The request was refused (some_new_code).')
  })
})

describe('fieldErrorsFrom', () => {
  it('maps parameter_invalid violations onto form fields', () => {
    const error = new FleetlessError('parameter_invalid', 'bad', { status: 400, details: { violations: [{ field: 'order', rule: 'max', message: 'at most 25' }] } })
    expect(fieldErrorsFrom(error)).toEqual([{ name: 'order', message: 'at most 25' }])
  })

  it('answers nothing for any other error', () => {
    expect(fieldErrorsFrom(new FleetlessError('forbidden', 'no'))).toEqual([])
    expect(fieldErrorsFrom(new Error('x'))).toEqual([])
  })
})

describe('isSignedOut', () => {
  it('is true for the refusals that mean the session is gone, and for no session at all', () => {
    for (const code of ['unauthorized', 'token_expired', 'token_revoked', 'no_session']) {
      expect(isSignedOut(new FleetlessError(code, 'x')), code).toBe(true)
    }
    expect(isSignedOut(new FleetlessError('forbidden', 'x'))).toBe(false)
  })
})

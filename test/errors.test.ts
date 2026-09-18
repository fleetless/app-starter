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

  it('names no wait for rate_limited without a number, rather than zero seconds', () => {
    expect(sentenceFor(new FleetlessError('rate_limited', 'slow down', { status: 429 }))).toBe('Too many attempts. Try again in a moment.')
  })

  it('names the console setting a target_state_conflict is about', () => {
    const error = new FleetlessError('target_state_conflict', 'unset', { status: 409, details: { fields: [{ field: 'default_role_id', rule: 'not_set', message: 'x' }] } })
    expect(sentenceFor(error)).toBe('The app is not set up for this yet: default_role_id is missing in the console.')
  })

  it('answers every OIDC callback code with a sentence, never a bare code', () => {
    // The twelve of `clientOidcErrorCode`; the callback page is the only screen
    // they arrive on, and a raw identifier there tells nobody what to do next.
    const table: [string, string][] = [
      ['no_access', 'This account has no access to this app.'],
      ['email_taken', 'That address already has an account here. Sign in with its password, or ask a developer to link the provider.'],
      ['email_unverified', 'The provider did not confirm that address. Verify it with the provider first.'],
      ['idp_unavailable', 'The identity provider did not answer.'],
      ['exchange_failed', 'The sign-in did not complete at the provider.'],
      ['claims_incomplete', 'The provider did not send an email address.'],
      ['provider_misconfigured', 'The provider is not set up correctly for this app.'],
      ['provider_disabled', 'That provider is switched off for this app.'],
      ['invalid_request', 'The sign-in request was malformed. Start again.'],
      ['quota_exceeded', 'This app has reached its user limit.'],
      ['domain_not_allowed', 'Addresses at that domain cannot register here.'],
      ['registration_closed', 'This app does not take new accounts.']
    ]
    for (const [code, sentence] of table) {
      expect(sentenceFor(new FleetlessError(code, 'server text')), code).toBe(sentence)
    }
  })

  it('says a live-only datapoint is not recorded, rather than empty', () => {
    expect(sentenceFor(new FleetlessError('not_recorded', 'live only'))).toBe('Nothing is recorded for this datapoint.')
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

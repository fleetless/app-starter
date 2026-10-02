import { describe, expect, it } from 'vitest'
import { FleetlessError } from '@fleetless/sdk'
import { fieldErrorsFrom, isDeadCode, isSignedOut, sentenceFor, twoFactorConflict } from '~/utils/errors'

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

const err = (code: string, details?: unknown) => new FleetlessError(code, code, { status: 400, details } as never)

describe('two-factor and code refusals', () => {
  it('names the attempts left, and only when there are some', () => {
    expect(sentenceFor(err('invalid_code', { attempts_left: 3 }))).toBe('That code is incorrect. 3 attempts left.')
    expect(sentenceFor(err('invalid_code', { attempts_left: 1 }))).toBe('That code is incorrect. 1 attempt left.')
    expect(sentenceFor(err('invalid_code', { attempts_left: 0 }))).toBe('That code is incorrect.')
    expect(sentenceFor(err('invalid_code'))).toBe('That code is incorrect.')
  })

  it('a spent code, or the last wrong guess, is dead', () => {
    expect(isDeadCode(err('token_spent'))).toBe(true)
    expect(isDeadCode(err('invalid_code', { attempts_left: 0 }))).toBe(true)
    expect(isDeadCode(err('invalid_code', { attempts_left: 2 }))).toBe(false)
    expect(isDeadCode(new Error('x'))).toBe(false)
  })

  it('reads the two-factor conflict the cloud answers', () => {
    const conflict = (rule: string) => err('target_state_conflict', { fields: [{ field: 'two_factor', rule, message: 'm' }] })
    expect(twoFactorConflict(conflict('required'))).toBe('required')
    expect(twoFactorConflict(conflict('off'))).toBe('off')
    expect(twoFactorConflict(err('target_state_conflict', { fields: [{ field: 'default_role_id', rule: 'missing' }] }))).toBeNull()
    expect(sentenceFor(conflict('required'))).toBe('This app requires two-factor; it cannot be switched off.')
  })

  it('a method the app has switched off', () => {
    expect(sentenceFor(err('method_not_allowed'))).toBe('This app does not accept that way of signing in.')
  })
})

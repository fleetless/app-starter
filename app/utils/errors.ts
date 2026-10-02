import { FleetlessError, parameterInvalidDetails } from '@fleetless/sdk'

const SIGNED_OUT = new Set(['unauthorized', 'token_expired', 'token_revoked', 'no_session'])

/** A refusal that means "no session any more", or the SDK saying there never was one. */
export function isSignedOut(error: unknown): boolean {
  return error instanceof FleetlessError && SIGNED_OUT.has(error.code)
}

/** A code or challenge that cannot be retried: spent, expired, or the last wrong guess just used it up. */
export function isDeadCode(error: unknown): boolean {
  if (!(error instanceof FleetlessError)) return false
  if (error.code === 'token_spent') return true
  const left = (error.details as { attempts_left?: unknown } | undefined)?.attempts_left
  return error.code === 'invalid_code' && left === 0
}

/**
 * The app's two-factor policy, as far as a refusal reveals it: no client
 * route carries it (plan ruling 3). `required` from turning it off, `off`
 * from setting it up (or from turning off what is not on).
 */
export function twoFactorConflict(error: unknown): 'required' | 'off' | null {
  if (!(error instanceof FleetlessError) || error.code !== 'target_state_conflict') return null
  const fields = (error.details as { fields?: { field?: string, rule?: string }[] } | undefined)?.fields
  const hit = Array.isArray(fields) ? fields.find(f => f.field === 'two_factor') : undefined
  return hit?.rule === 'required' || hit?.rule === 'off' ? hit.rule : null
}

/**
 * The one sentence the UI shows for a refusal. Every sentence says what did
 * not happen; none guesses why. `invalid_credentials` is one sentence on
 * purpose: a wrong password, a blocked account and an unverified address all
 * answer it, and a UI that told them apart would tell a stranger which
 * addresses exist.
 */
export function sentenceFor(error: unknown): string {
  if (!(error instanceof FleetlessError)) return 'The request did not go through.'
  const details = error.details as Record<string, unknown> | undefined
  switch (error.code) {
    case 'invalid_credentials': return 'That email and password do not match.'
    case 'token_spent': return 'This link has been used already, or it expired.'
    case 'registration_closed': return 'This app does not take new accounts.'
    case 'domain_not_allowed': return 'Addresses at that domain cannot register here.'
    // The rest of `clientOidcErrorCode`. These arrive on one screen only, the
    // OIDC callback, where a bare code leaves the person with nothing to try.
    case 'no_access': return 'This account has no access to this app.'
    case 'email_taken': return 'That address already has an account here. Sign in with its password, or ask a developer to link the provider.'
    case 'email_unverified': return 'The provider did not confirm that address. Verify it with the provider first.'
    case 'idp_unavailable': return 'The identity provider did not answer.'
    case 'exchange_failed': return 'The sign-in did not complete at the provider.'
    case 'claims_incomplete': return 'The provider did not send an email address.'
    case 'provider_misconfigured': return 'The provider is not set up correctly for this app.'
    case 'provider_disabled': return 'That provider is switched off for this app.'
    case 'invalid_request': return 'The sign-in request was malformed. Start again.'
    case 'quota_exceeded': return 'This app has reached its user limit.'
    case 'weak_password': return 'That password is too short. Twelve characters or more.'
    case 'rate_limited': {
      // No number is better than a wrong one: "in 0 seconds" invites a retry
      // that is refused again.
      const ms = typeof details?.retry_after_ms === 'number' ? details.retry_after_ms : null
      return ms === null ? 'Too many attempts. Try again in a moment.' : `Too many attempts. Try again in ${Math.ceil(ms / 1000)} seconds.`
    }
    case 'invalid_code': {
      const left = typeof details?.attempts_left === 'number' ? details.attempts_left : 0
      return left > 0 ? `That code is incorrect. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.` : 'That code is incorrect.'
    }
    case 'method_not_allowed': return 'This app does not accept that way of signing in.'
    case 'target_state_conflict': {
      const twoFactor = twoFactorConflict(error)
      if (twoFactor === 'required') return 'This app requires two-factor; it cannot be switched off.'
      if (twoFactor === 'off') return 'Two-factor is not on for this account or this app.'
      const fields = Array.isArray(details?.fields) ? (details.fields as { field?: string }[]) : []
      const field = fields[0]?.field ?? 'a setting'
      return `The app is not set up for this yet: ${field} is missing in the console.`
    }
    case 'forbidden': return 'Your role does not allow that.'
    case 'capability_required': return 'Your role does not include that capability.'
    case 'not_found': return 'That does not exist, or you cannot reach it.'
    case 'robot_offline': return 'The robot is offline.'
    case 'busy': return 'Something is already running there.'
    case 'parameter_invalid':
    case 'validation_error': return 'A value was refused.'
    case 'no_snapshot_yet': return 'No snapshot has been captured yet.'
    // Live-only, not empty: the fix is to switch recording on in the console,
    // not to look at another window.
    case 'not_recorded': return 'Nothing is recorded for this datapoint.'
    case 'camera_offline': return 'The camera is offline.'
    case 'interaction_expired': return 'This sign-in request is no longer valid.'
    case 'state_mismatch': return 'The sign-in did not come back the way it left. Start again.'
    case 'command_timeout': return 'The robot did not finish in time.'
    case 'no_websocket': return 'This browser has no WebSocket.'
    default: return `The request was refused (${error.code}).`
  }
}

/** `parameter_invalid` names every violation at once; hand each to its form field. */
export function fieldErrorsFrom(error: unknown): { name: string, message: string }[] {
  if (!(error instanceof FleetlessError) || error.code !== 'parameter_invalid') return []
  const parsed = parameterInvalidDetails.safeParse(error.details)
  if (!parsed.success) return []
  return parsed.data.violations.map(v => ({ name: v.field, message: v.message }))
}

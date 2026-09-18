import { FleetlessError, parameterInvalidDetails } from '@fleetless/sdk'

const SIGNED_OUT = new Set(['unauthorized', 'token_expired', 'token_revoked', 'no_session'])

/** A refusal that means "no session any more", or the SDK saying there never was one. */
export function isSignedOut(error: unknown): boolean {
  return error instanceof FleetlessError && SIGNED_OUT.has(error.code)
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
    case 'weak_password': return 'That password is too short. Twelve characters or more.'
    case 'rate_limited': {
      const ms = typeof details?.retry_after_ms === 'number' ? details.retry_after_ms : 0
      return `Too many attempts. Try again in ${Math.ceil(ms / 1000)} seconds.`
    }
    case 'target_state_conflict': {
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

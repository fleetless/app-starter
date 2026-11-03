import { FleetlessError, type SignInMethods } from '@fleetless/sdk'
import { sentenceFor } from '~/utils/errors'

/** What the sign-in form reads: which methods are on, and nothing else. */
export type LoginMethods = Pick<SignInMethods, 'password' | 'emailCode'>

type TwoFactorPolicy = SignInMethods['twoFactor']

const isPolicy = (value: unknown): value is TwoFactorPolicy => value === 'off' || value === 'optional' || value === 'required'

/**
 * The SDK type is compile-time only. The sign-in form needs no two-factor
 * policy, and a cloud from before it answers none, so `twoFactor` is not
 * looked at: a code-only app keeps its code sign-in there. `null` is an
 * unreadable answer.
 */
export function loginMethodsFrom(value: unknown): LoginMethods | null {
  if (!value || typeof value !== 'object') return null
  const { password, emailCode } = value as Partial<LoginMethods>
  return typeof password === 'boolean' && typeof emailCode === 'boolean' ? { password, emailCode } : null
}

/**
 * Security and the invitation act on the policy: a missing, `null` or
 * unknown one is as unreadable as a failed request, never `off`.
 */
export function requireSignInMethods(value: unknown): SignInMethods {
  const methods = loginMethodsFrom(value)
  const twoFactor = (value as Partial<SignInMethods> | null)?.twoFactor
  if (!methods || !isPolicy(twoFactor)) throw new Error('Invalid sign-in methods')
  return { ...methods, twoFactor }
}

/** A refusal keeps its own sentence (`rate_limited` its wait); no answer, or no valid one, says `fallback`. */
export function readProblem(error: unknown, fallback: string): string {
  return error instanceof FleetlessError ? sentenceFor(error) : fallback
}

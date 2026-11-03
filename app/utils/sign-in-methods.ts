import type { SignInMethods } from '@fleetless/sdk'

/** The SDK type is compile-time only; older clouds may omit the new policy. */
export function requireSignInMethods(value: unknown): SignInMethods {
  if (!value || typeof value !== 'object') throw new Error('Invalid sign-in methods')
  const methods = value as Partial<SignInMethods>
  if (typeof methods.password !== 'boolean' || typeof methods.emailCode !== 'boolean'
    || !['off', 'optional', 'required'].includes(methods.twoFactor as string)) {
    throw new Error('Invalid sign-in methods')
  }
  return methods as SignInMethods
}

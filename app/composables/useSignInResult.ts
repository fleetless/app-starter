import type { SignInResult } from '@fleetless/sdk'
import { challengePath, forgetChallenge, rememberChallenge } from '~/utils/sign-in-challenge'

export type FollowOutcome = 'signed_in' | 'second_factor' | 'storage_refused'

export const STORAGE_REFUSED = 'This browser refused to keep the sign-in state.'

/**
 * The one place a sign-in step's answer is read. Every call that can mint a
 * session — `login`, `verifyLoginCode`, `acceptInvitation`, `verifyEmail`,
 * `confirmPasswordReset` — hands its `SignInResult` here; no page branches
 * on the two-factor statuses itself.
 *
 * `signed_in` returns without navigating: the caller lands where it always
 * did (the MCP page reloads its interaction in place). A challenge goes to
 * the second-factor page, which lands on `next` when it is done.
 */
export function useSignInResult() {
  // Read before the first await, while the Nuxt instance is current.
  const { onSignedIn } = useSession()

  async function follow(result: SignInResult, next: string): Promise<FollowOutcome> {
    if (result.status === 'signed_in') {
      forgetChallenge()
      await onSignedIn()
      return 'signed_in'
    }
    if (!rememberChallenge({ status: result.status, challenge: result.challenge, next })) return 'storage_refused'
    await navigateTo(challengePath(result.status))
    return 'second_factor'
  }

  /** A dead challenge (five wrong codes, or past five minutes): back to the start, saying why. */
  async function restart(next: string | undefined): Promise<void> {
    forgetChallenge()
    await navigateTo({ path: '/auth/login', query: { reason: 'expired', ...(next ? { next } : {}) } })
  }

  return { follow, restart }
}

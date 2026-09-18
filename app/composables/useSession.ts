import type { ClientIdentity } from '@fleetless/sdk'
import { isSignedOut } from '~/utils/errors'

/**
 * Who is signed in, resolved once per page life from `auth.me()`, and the
 * one place a "no session any more" refusal turns into the login page.
 */
export function useSession() {
  const client = useFleetless()
  const identity = useState<ClientIdentity | null>('session-identity', () => null)
  const resolved = useState<boolean>('session-resolved', () => false)

  async function resolve(): Promise<ClientIdentity | null> {
    if (resolved.value) return identity.value
    try {
      identity.value = await client.auth.me()
    } catch (error) {
      if (!isSignedOut(error)) throw error
      identity.value = null
    }
    resolved.value = true
    return identity.value
  }

  /** After any call that stored a session: read who that is. */
  async function onSignedIn(): Promise<void> {
    identity.value = await client.auth.me()
    resolved.value = true
  }

  async function signOut(): Promise<void> {
    await client.auth.logout()
    identity.value = null
    resolved.value = true
    await navigateTo('/auth/login')
  }

  /** Sends a caller whose session is gone to the login page. True when it did. */
  async function expire(error: unknown, next?: string): Promise<boolean> {
    if (!isSignedOut(error)) return false
    identity.value = null
    resolved.value = true
    await navigateTo({ path: '/auth/login', query: next ? { next } : {} })
    return true
  }

  return { identity, resolve, onSignedIn, signOut, expire }
}

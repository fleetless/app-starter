import type { ClientIdentity } from '@fleetless/sdk'

export function useSession() {
  const identity = useState<ClientIdentity | null>('session-identity', () => null)
  async function signOut() {
    identity.value = null
    await navigateTo('/auth/login')
  }
  return { identity, signOut }
}

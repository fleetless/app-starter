import { sentenceFor } from '~/utils/errors'
import { takeOidc } from '~/utils/oidc'
import { safeNext } from '~/utils/routes'

export interface OidcReturn {
  /** True only when the exchange ran and a session is stored. */
  signedIn: boolean
  /** The one sentence to show, or null when there is nothing to say. */
  problem: string | null
  /** Where the sign-in was headed before the detour, guarded. */
  next: string
}

/**
 * The return leg of a provider sign-in, for every page a redirect can land on:
 * the callback page, and the MCP consent page, which keeps the round trip to
 * itself so the interaction is not lost on the way. Both need the same four
 * steps, and the two copies had already drifted.
 *
 * The URL is cleaned before the exchange rather than after it: the code is
 * worth nothing after one attempt either way, and a failed exchange should
 * leave no credential in the address bar.
 */
export async function useOidcReturn(replaceWith: string): Promise<OidcReturn> {
  // Both composables are read before the first await, while the Nuxt instance
  // is still the current one.
  const client = useFleetless()
  const { onSignedIn } = useSession()

  const params = new URL(window.location.href).searchParams
  // Nothing came back with this browser, so nothing is spent — a plain visit
  // must not consume the remembered pair.
  if (!params.has('code') && !params.has('error')) return { signedIn: false, problem: null, next: '/robots' }

  const failure = client.auth.oidcErrorFromCallback(params)
  const remembered = takeOidc()
  // Guarded here rather than where it was written: what comes back out of the
  // store is as much a stranger's string as the query parameter was.
  const next = safeNext(remembered?.next)
  window.history.replaceState({}, '', replaceWith)
  if (failure) return { signedIn: false, problem: sentenceFor(failure), next }

  try {
    await client.auth.completeOidcLogin({
      code: params.get('code') ?? '',
      state: params.get('state') ?? '',
      expectedState: remembered?.state ?? '',
      codeVerifier: remembered?.verifier ?? ''
    })
    await onSignedIn()
    return { signedIn: true, problem: null, next }
  } catch (error) {
    return { signedIn: false, problem: sentenceFor(error), next }
  }
}

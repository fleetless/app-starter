const KEY = 'fleetless-oidc'

export interface RememberedOidc {
  state: string
  verifier: string
  /** Where the sign-in was headed, unguarded: whoever reads it back guards it. */
  next?: string
}

/**
 * The PKCE verifier, the state and the destination survive exactly one
 * redirect, in this tab only. False means the browser refused to keep them —
 * a private window with storage blocked — and the round trip cannot complete
 * without them, so there is no point in leaving the page.
 */
export function rememberOidc(state: string, verifier: string, next?: string): boolean {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ state, verifier, next }))
    return true
  } catch {
    return false
  }
}

export function takeOidc(): RememberedOidc | null {
  let raw: string | null
  try {
    raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
  } catch {
    // A blocked store has nothing to hand back, and a throw here would land
    // in the callback page's onMounted with no sentence attached.
    return null
  }
  if (!raw) return null
  try {
    return JSON.parse(raw) as RememberedOidc
  } catch {
    return null
  }
}

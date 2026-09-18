const KEY = 'fleetless-oidc'

/** The PKCE verifier and the state survive exactly one redirect, in this tab only. */
export function rememberOidc(state: string, verifier: string): void {
  sessionStorage.setItem(KEY, JSON.stringify({ state, verifier }))
}

export function takeOidc(): { state: string, verifier: string } | null {
  const raw = sessionStorage.getItem(KEY)
  sessionStorage.removeItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as { state: string, verifier: string }
  } catch {
    return null
  }
}

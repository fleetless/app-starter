const KEY = 'fleetless-sign-in-challenge'

export type ChallengeStatus = 'two_factor_required' | 'two_factor_setup_required'

export interface PendingChallenge {
  status: ChallengeStatus
  /** Five minutes, five wrong codes. A credential: never in a URL, never logged. */
  challenge: string
  /** Where the sign-in was headed, unguarded: whoever reads it back guards it with `safeNext`. */
  next?: string
}

/**
 * The second factor is its own page, so the challenge a sign-in step
 * answered has to cross one navigation, in this tab only. False means the
 * browser refused to keep it (storage blocked) and the step cannot go on.
 */
export function rememberChallenge(pending: PendingChallenge): boolean {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending))
    return true
  } catch {
    return false
  }
}

/** Not removed on read: a reload of the second-factor page keeps its step. `forgetChallenge` ends it. */
export function readChallenge(): PendingChallenge | null {
  let raw: string | null
  try {
    raw = sessionStorage.getItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<PendingChallenge>
    const statusOk = value.status === 'two_factor_required' || value.status === 'two_factor_setup_required'
    if (!statusOk || typeof value.challenge !== 'string' || value.challenge === '') return null
    return { status: value.status!, challenge: value.challenge, next: typeof value.next === 'string' ? value.next : undefined }
  } catch {
    return null
  }
}

export function forgetChallenge(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing kept, nothing to forget.
  }
}

export function challengePath(status: ChallengeStatus): '/auth/two-factor' | '/auth/two-factor/setup' {
  return status === 'two_factor_required' ? '/auth/two-factor' : '/auth/two-factor/setup'
}

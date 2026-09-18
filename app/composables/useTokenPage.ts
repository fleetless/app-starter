import { FleetlessError } from '@fleetless/sdk'
import { sentenceFor } from '~/utils/errors'

export type TokenOutcome = 'spent' | 'failed'

/** Unknown, expired and used tokens all answer `token_spent`; one message covers them. */
export function outcomeOf(error: unknown): TokenOutcome {
  return error instanceof FleetlessError && error.code === 'token_spent' ? 'spent' : 'failed'
}

/**
 * The shape every token page shares: read the token from the path, spend it
 * with the call the page names, replace the URL so the single-use credential
 * does not linger in history, then treat the person as signed in — the three
 * routes that take a token all answer a session.
 */
export function useTokenPage(spend: (token: string) => Promise<void>, replaceWith: string) {
  const route = useRoute()
  const { onSignedIn } = useSession()
  const state = ref<'spending' | 'done' | TokenOutcome>('spending')
  const problem = ref<string | null>(null)

  async function run() {
    const token = typeof route.params.token === 'string' ? route.params.token : ''
    try {
      await spend(token)
      window.history.replaceState({}, '', replaceWith)
      await onSignedIn()
      state.value = 'done'
    } catch (error) {
      state.value = outcomeOf(error)
      problem.value = sentenceFor(error)
    }
  }

  return { state, problem, run }
}

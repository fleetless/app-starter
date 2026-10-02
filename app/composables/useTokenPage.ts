import { FleetlessError, type SignInResult } from '@fleetless/sdk'
import { sentenceFor } from '~/utils/errors'
import { STORAGE_REFUSED } from '~/composables/useSignInResult'

export type TokenOutcome = 'spent' | 'failed'

/** Unknown, expired and used tokens all answer `token_spent`; one message covers them. */
export function outcomeOf(error: unknown): TokenOutcome {
  return error instanceof FleetlessError && error.code === 'token_spent' ? 'spent' : 'failed'
}

/**
 * The shape every token page shares: read the token from the path, spend it
 * with the call the page names, replace the URL so the single-use credential
 * does not linger in history, then follow the sign-in result — signed in
 * (`done`; the page lands), or on to the second factor (`follow` has
 * navigated; the page keeps saying "One moment").
 */
export function useTokenPage(spend: (token: string) => Promise<SignInResult>, replaceWith: string, next = '/robots') {
  const route = useRoute()
  const { follow } = useSignInResult()
  const state = ref<'spending' | 'done' | TokenOutcome>('spending')
  const problem = ref<string | null>(null)

  async function run() {
    // A second submit starts clean: the last sentence is not the new attempt's.
    state.value = 'spending'
    problem.value = null
    const token = typeof route.params.token === 'string' ? route.params.token : ''
    try {
      const result = await spend(token)
      window.history.replaceState({}, '', replaceWith)
      const outcome = await follow(result, next)
      if (outcome === 'signed_in') state.value = 'done'
      else if (outcome === 'storage_refused') {
        state.value = 'failed'
        problem.value = STORAGE_REFUSED
      }
    } catch (error) {
      state.value = outcomeOf(error)
      problem.value = sentenceFor(error)
    }
  }

  return { state, problem, run }
}

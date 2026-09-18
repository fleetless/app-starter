import type { ClientRobotListItem } from '@fleetless/sdk'
import { sentenceFor } from '~/utils/errors'

/**
 * The robots this app user reaches — the list the role grants, not the fleet.
 * A refusal that means "no session any more" goes to the login page instead of
 * into `problem`, which would show a dead screen behind a gone session.
 */
export function useRobots() {
  const client = useFleetless()
  const { expire } = useSession()
  const robots = ref<ClientRobotListItem[]>([])
  const loading = ref(false)
  const problem = ref<string | null>(null)

  async function reload() {
    loading.value = true
    problem.value = null
    try {
      robots.value = await client.robots.list()
    } catch (error) {
      if (!(await expire(error, '/robots'))) problem.value = `The robot list did not load. ${sentenceFor(error)}`
    } finally {
      loading.value = false
    }
  }

  return { robots, loading, problem, reload }
}

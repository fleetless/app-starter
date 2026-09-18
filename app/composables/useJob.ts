import type { JobEvent } from '@fleetless/sdk'
import { sentenceFor } from '~/utils/errors'

/** The current job on one action slug, live: state, progress, feedback, result. */
export function useJob(robotId: string, slug: string) {
  const client = useFleetless()
  const event = ref<JobEvent | null>(null)
  const problem = ref<string | null>(null)
  // Optional on purpose, as in `useDatapoint`: under the robot page a
  // `forbidden` means the role changed and the page re-reads the sheet; away
  // from that page there is nothing to re-read, so the sentence stands.
  const context = inject(RobotSheet, null)

  const subscription = client.actions.subscribe(robotId, slug, {
    onJob(next) {
      event.value = next
    },
    onError(error) {
      if (!context) {
        problem.value = sentenceFor(error)
        return
      }
      void context.onError(error).then((sentence) => {
        problem.value = sentence
      })
    }
  })
  // The scope, not the component: a panel unmounted inside a v-if still releases its slug.
  onScopeDispose(() => subscription.unsubscribe())

  const running = computed(() => event.value?.job.state === 'running')
  return { event, running, problem }
}

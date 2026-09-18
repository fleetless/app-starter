import { sentenceFor } from '~/utils/errors'

/** One live datapoint: the current value first, then every change, for as long as the component lives. */
export function useDatapoint(robotId: string, slug: string) {
  const client = useFleetless()
  const value = ref<unknown>(undefined)
  const timestampMs = ref<number | null>(null)
  const problem = ref<string | null>(null)
  // Optional on purpose: under the robot page a `forbidden` means the role
  // changed, and the page re-reads the sheet instead of leaving a dead card.
  // Away from that page there is nothing to re-read, so the sentence stands.
  const context = inject(RobotSheet, null)

  const subscription = client.datapoints.subscribe(robotId, slug, {
    onEvent(event) {
      value.value = event.value
      timestampMs.value = event.timestamp_ms
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
  // The scope, not the component: a card unmounted inside a v-if still releases its slug.
  onScopeDispose(() => subscription.unsubscribe())

  return { value, timestampMs, problem }
}

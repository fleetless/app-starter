import type { CollectionDefinition, CollectionEvent, CollectionRecord } from '@fleetless/sdk'
import { isSignedOut, sentenceFor } from '~/utils/errors'

/** The collection `collections.yaml` defines. */
const COLLECTION = 'logbook'

/**
 * One robot's logbook, live: the newest entries, then every change to them.
 * What the person may do comes from the cloud's `definitions()`, which is the
 * answer to "which buttons do I draw"; nothing here guesses it from the role.
 */
export function useLogbook(robotId: string) {
  const client = useFleetless()
  const entries = ref<CollectionRecord[]>([])
  const canCreate = ref(false)
  /** False when the app has published no `logbook` collection, or this role may not read it. */
  const defined = ref(false)
  const categories = ref<{ label: string, value: string }[]>([])
  const loaded = ref(false)
  const problem = ref<string | null>(null)
  // Optional on purpose, as in `useDatapoint`: under the robot page a refusal
  // goes the way of every other tab (a lapsed session signs out, a `forbidden`
  // re-reads the sheet); away from it the sentence stands.
  const context = inject(RobotSheet, null)

  // The cloud sends no first snapshot, so the list is read after subscribing,
  // and a change can land while it is on its way. Those changes wait here and
  // are applied on top of the list, which is a snapshot from somewhere in the
  // middle of the same stream.
  let waiting: CollectionEvent[] | null = []
  let generation = 0

  function report(error: unknown): Promise<string | null> {
    return context ? context.onError(error) : Promise.resolve(sentenceFor(error))
  }

  function read(found: CollectionDefinition | undefined) {
    defined.value = found !== undefined
    canCreate.value = found?.can.create === true
    const field = found?.fields.category
    categories.value = field?.type === 'select' ? field.options.map(o => ({ label: o.label ?? o.value, value: o.value })) : []
  }

  async function load() {
    const mine = ++generation
    waiting = []
    problem.value = null
    try {
      const found = (await client.collections.definitions()).find(d => d.key === COLLECTION)
      // A newer load (a publish, say) has taken over: it drains `waiting`.
      if (mine !== generation) return
      read(found)
      const page = found ? await client.collections.list(COLLECTION, { robot: robotId, sort: ['-created_at'], limit: 50 }) : null
      if (mine !== generation) return
      entries.value = page?.records ?? []
    } catch (error) {
      if (mine !== generation) return
      problem.value = await report(error)
    }
    const missed = waiting ?? []
    waiting = null
    missed.forEach(apply)
    loaded.value = true
  }

  function apply({ event, id, record }: CollectionEvent) {
    const list = entries.value
    const at = list.findIndex(e => e.id === id)
    const held = list[at]
    if (event === 'deleted' || event === 'removed') {
      if (held) list.splice(at, 1)
      return
    }
    if (!record) return
    // A record outside the loaded window stays outside; one already held is
    // replaced only by a revision that is not older.
    if (held) {
      if (record.revision >= held.revision) list[at] = record
      return
    }
    if (event === 'updated') return
    if (event === 'created') {
      list.unshift(record)
      return
    }
    const place = list.findIndex(e => Date.parse(e.created_at) < Date.parse(record.created_at))
    list.splice(place === -1 ? list.length : place, 0, record)
  }

  async function add(text: string, category?: string) {
    problem.value = null
    try {
      const values: Record<string, unknown> = { text }
      if (category) values.category = category
      // Through `apply` like the event that follows it, so the entry shows once.
      const record = await client.collections.create(COLLECTION, values, { robot: robotId })
      apply({ event: 'created', id: record.id, record })
    } catch (error) {
      // Not `report` alone: a refusal of the write the person just made has to
      // say something, and a `forbidden` is answered with a sheet reload and no
      // sentence. A lapsed session is the exception: the login page follows.
      problem.value = (await report(error)) ?? (isSignedOut(error) ? null : sentenceFor(error))
    }
  }

  const unsubscribe = client.collections.subscribe(COLLECTION, {
    robot: robotId,
    onError(error) {
      // The collection is gone, or was never readable: the empty state says so.
      if (error.code === 'collection_not_found' || error.code === 'collection_removed') {
        read(undefined)
        entries.value = []
        loaded.value = true
        return
      }
      void report(error).then((sentence) => {
        problem.value = sentence
      })
    },
    // Rights, fields and the data itself may have changed, and a publish sends no record events.
    onSchemaPublished: () => void load()
  }, (event) => {
    if (waiting) waiting.push(event)
    else apply(event)
  })
  // The scope, not the component: a tab unmounted inside a v-if still lets go.
  onScopeDispose(unsubscribe)
  void load()

  return { entries, canCreate, defined, categories, loaded, problem, add }
}

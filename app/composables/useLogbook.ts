import type { CollectionDefinition, CollectionEvent, CollectionRecord } from '@fleetless/sdk'
import { LOGBOOK_COLLECTION as COLLECTION } from '~/utils/datasheet'
import { isSignedOut, sentenceFor } from '~/utils/errors'

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
  /** True once the list was read: only then is an empty list "nothing written yet" rather than "not known". */
  const listed = ref(false)
  /** The last read of the schema or the list did not go through: the tab offers to try again. */
  const failed = ref(false)
  const problem = ref<string | null>(null)
  // Optional on purpose, as in `useDatapoint`: under the robot page a refusal
  // goes the way of every other tab (a lapsed session signs out, a `forbidden`
  // re-reads the sheet); away from it the sentence stands.
  const context = inject(RobotSheet, null)

  // The cloud sends no first snapshot, so the list is read once the cloud has
  // confirmed the subscription (`onReady`), and a change can land while it is
  // on its way. Those changes wait here and are applied on top of the list,
  // which is a snapshot from somewhere in the middle of the same stream.
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
    // Whatever started this read, the fallback for a confirmation that has not come is no longer needed.
    stopWaitingForReady()
    const mine = ++generation
    waiting = []
    problem.value = null
    failed.value = false
    try {
      const found = (await client.collections.definitions()).collections.find(d => d.key === COLLECTION)
      // A newer load (a publish, say) has taken over: it drains `waiting`.
      if (mine !== generation) return
      read(found)
      const page = found ? await client.collections.list(COLLECTION, { robot: robotId, sort: ['-created_at'], limit: 50 }) : null
      if (mine !== generation) return
      entries.value = page?.records ?? []
      listed.value = true
    } catch (error) {
      if (mine !== generation) return
      failed.value = true
      listed.value = false
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

  // The codes with which the SDK ends a subscription (its `onError` says which): after one of these
  // nothing more arrives, and only a new `subscribe` brings the tab live again.
  const ENDS = new Set(['collection_not_found', 'collection_removed', 'forbidden', 'robot_not_attached', 'validation_error', 'internal_error'])
  let unsubscribe: () => void = () => {}
  let live = false

  // The cloud confirms a subscription within a moment. When it does not (a network that blocks the WebSocket, a
  // channel that cannot open: the SDK retries without raising an error) the tab would say that it loads for ever,
  // although the list is one request away. So it reads once after a few seconds, without the confirmation; if the
  // confirmation comes later, `onReady` still reads again, as it does after every reconnect.
  const READY_WAIT_MS = 5_000
  let readyWait: ReturnType<typeof setTimeout> | undefined

  function stopWaitingForReady() {
    clearTimeout(readyWait)
    readyWait = undefined
  }

  function connect() {
    // Harmless when the SDK has already ended it.
    unsubscribe()
    live = true
    stopWaitingForReady()
    readyWait = setTimeout(() => {
      readyWait = undefined
      if (live && !loaded.value) void load()
    }, READY_WAIT_MS)
    unsubscribe = client.collections.subscribe(COLLECTION, {
      robot: robotId,
      onError(error) {
        if (ENDS.has(error.code)) live = false
        // The collection is gone, or was never readable: the empty state says so.
        if (error.code === 'collection_not_found' || error.code === 'collection_removed') {
          read(undefined)
          entries.value = []
          loaded.value = true
          return
        }
        // The cloud could not check on the subscription and let it go, and no read failed: the tab says
        // so and offers the same "Try again", which subscribes again.
        if (error.code === 'internal_error') failed.value = true
        void report(error).then((sentence) => {
          problem.value = sentence
          // A role change closed the subscription, and with it what the person may read and write may have
          // changed: read it again so the tab does not go on showing what the role no longer reaches. Not a
          // new subscription: a role that cannot read would be refused again, and again.
          if (error.code === 'forbidden') {
            void load()
            return
          }
          // Refused, or the channel could not open, before the cloud ever confirmed it: `onReady` is not
          // coming, so the tab stops saying it loads, says what happened and offers "Try again".
          if (!loaded.value) {
            failed.value = true
            loaded.value = true
          }
        })
      },
      // Rights, fields and the data itself may have changed, and a publish sends no record events. Only a
      // running subscription hears of it: before the first publish the cloud refused this one, so the
      // empty state offers `reload` instead.
      onSchemaPublished: () => void load(),
      // The cloud confirmed the subscription: the first time, and again after every reconnect, when what
      // changed while the connection was down was not replayed. From here on every change arrives as an
      // event, so this is where the list is read, and the one place it is read for these two reasons.
      // Events that arrive meanwhile wait, as after a publish.
      onReady: () => void load()
    }, (event) => {
      if (waiting) waiting.push(event)
      else apply(event)
    })
  }

  /**
   * Reads the schema and the list again. When the cloud ended the subscription (no collection yet, one
   * removed, a role changed) it subscribes again instead, and the read follows the cloud's confirmation,
   * so that what comes of it is live as well; until then the tab says it loads. For the buttons "Check
   * again" and "Try again".
   */
  async function reload() {
    if (live) {
      await load()
      return
    }
    problem.value = null
    failed.value = false
    loaded.value = false
    connect()
  }

  // The scope, not the component: a tab unmounted inside a v-if still lets go.
  onScopeDispose(() => {
    stopWaitingForReady()
    unsubscribe()
  })
  // Nothing is read here: the list is read when the cloud confirms the subscription, which is also
  // when the first paint stops saying that it loads (or, failing that, after a few seconds).
  connect()

  return { entries, canCreate, defined, categories, loaded, listed, failed, problem, add, reload }
}

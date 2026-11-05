import type { McpRobotDatasheet } from '@fleetless/sdk'
import type { InjectionKey, Ref } from 'vue'
import { FleetlessError } from '@fleetless/sdk'
import { LOGBOOK_COLLECTION } from '~/utils/datasheet'
import { sentenceFor } from '~/utils/errors'

export interface RobotSheetContext {
  sheet: Ref<McpRobotDatasheet | null>
  reload(): Promise<void>
  /** Every tab hands its refusals here: a `forbidden` means the role changed, so the sheet is re-read instead of an error shown. */
  onError(error: unknown): Promise<string | null>
}

export const RobotSheet: InjectionKey<RobotSheetContext> = Symbol('RobotSheet')

/**
 * What this app user may do on one robot. The page reads it once and provides
 * it; every tab below reads the same sheet rather than describing again.
 */
export function useDatasheet(robotId: string) {
  const client = useFleetless()
  const { expire } = useSession()
  const sheet = ref<McpRobotDatasheet | null>(null)
  /** Whether the role may read the logbook collection: the sheet does not say, the schema's own answer does. */
  const logbook = ref(false)
  const loading = ref(false)
  const problem = ref<string | null>(null)

  // A role change refuses every open subscription at once, and each one asks for
  // a reload. They share the read in flight rather than describing the robot once
  // per card.
  let inFlight: Promise<void> | null = null

  function reload(): Promise<void> {
    inFlight ??= read().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  /**
   * `definitions` lists the collections the role may read, so the logbook is
   * there or it is not. A failed read is "not readable" here and no failure of
   * the page: the Logbook tab reads the schema itself and says what went wrong.
   */
  async function readsLogbook(): Promise<boolean> {
    try {
      return (await client.collections.definitions()).some(d => d.key === LOGBOOK_COLLECTION)
    } catch {
      return false
    }
  }

  async function read() {
    loading.value = true
    problem.value = null
    try {
      const [described, readable] = await Promise.all([client.robots.describe(robotId), readsLogbook()])
      sheet.value = described
      logbook.value = readable
    } catch (error) {
      if (!(await expire(error, `/robots/${robotId}`))) problem.value = `The robot did not load. ${sentenceFor(error)}`
    } finally {
      loading.value = false
    }
  }

  async function onError(error: unknown): Promise<string | null> {
    if (await expire(error)) return null
    if (error instanceof FleetlessError && error.code === 'forbidden') {
      await reload()
      return null
    }
    return sentenceFor(error)
  }

  const context: RobotSheetContext = { sheet, reload, onError }
  provide(RobotSheet, context)
  return { sheet, logbook, loading, problem, reload, onError }
}

export function useRobotSheet(): RobotSheetContext {
  const context = inject(RobotSheet)
  if (!context) throw new Error('useRobotSheet: no robot page above this component')
  return context
}

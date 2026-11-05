import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import type { McpRobotDatasheet } from '@fleetless/sdk'
import { refusal } from './fake-auth'
import { tabsFor } from '~/utils/datasheet'

const ROBOT = '00000000-0000-4000-8000-000000000001'

const fake = vi.hoisted(() => ({
  describe: vi.fn(),
  definitions: vi.fn()
}))
mockNuxtImport('useFleetless', () => () => ({ robots: { describe: fake.describe }, collections: { definitions: fake.definitions } }))

const nothing: McpRobotDatasheet = { robot_id: ROBOT, robot_name: 'rx1', capabilities: { action_history: false, assets: false }, exposures: [] }
const logbook = { key: 'logbook', label: 'Logbook' }

let sheetPage: ReturnType<typeof useDatasheet>
const Harness = defineComponent({
  setup() {
    sheetPage = useDatasheet(ROBOT)
    return () => h('div')
  }
})

beforeEach(() => {
  fake.describe.mockReset()
  fake.definitions.mockReset()
  fake.describe.mockResolvedValue(nothing)
})

describe('the robot page\'s sheet', () => {
  it('knows whether the role may read the logbook, which the sheet does not say', async () => {
    fake.definitions.mockResolvedValue([{ key: 'other', label: 'Other' }, logbook])
    await mountSuspended(Harness)
    await sheetPage.reload()

    expect(sheetPage.logbook.value).toBe(true)
    // A robot with nothing else still has its Logbook.
    expect(tabsFor(sheetPage.sheet.value!, sheetPage.logbook.value).map(t => t.key)).toEqual(['logbook'])
  })

  it('has no Logbook where the role may read no logbook collection', async () => {
    fake.definitions.mockResolvedValue([{ key: 'other', label: 'Other' }])
    await mountSuspended(Harness)
    await sheetPage.reload()

    expect(sheetPage.logbook.value).toBe(false)
    expect(tabsFor(sheetPage.sheet.value!, sheetPage.logbook.value)).toEqual([])
  })

  it('does not fail the page when the schema cannot be read', async () => {
    fake.definitions.mockRejectedValue(refusal('internal_error', undefined, 500))
    await mountSuspended(Harness)
    await sheetPage.reload()

    expect(sheetPage.sheet.value?.robot_name).toBe('rx1')
    expect(sheetPage.logbook.value).toBe(false)
    expect(sheetPage.problem.value).toBeNull()
  })

  it('reads the sheet and the schema together, and a failed sheet is still the page\'s failure', async () => {
    fake.definitions.mockResolvedValue([logbook])
    fake.describe.mockRejectedValue(refusal('internal_error', undefined, 500))
    await mountSuspended(Harness)
    await sheetPage.reload()

    expect(sheetPage.sheet.value).toBeNull()
    expect(sheetPage.problem.value).toContain('The robot did not load.')
    expect(fake.definitions).toHaveBeenCalledTimes(1)
  })
})

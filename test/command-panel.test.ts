import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { JobEvent, JobState, McpExposure } from '@fleetless/sdk'
import CommandPanel from '~/components/robot/CommandPanel.vue'
import { RobotSheet, type RobotSheetContext } from '~/composables/useDatasheet'

const fake = vi.hoisted(() => ({
  handlers: null as { onJob(event: JobEvent): void } | null,
  unsubscribed: 0
}))

mockNuxtImport('useFleetless', () => () => ({
  actions: {
    subscribe(_robotId: string, _slug: string, handlers: { onJob(event: JobEvent): void }) {
      fake.handlers = handlers
      return {
        unsubscribe() {
          fake.unsubscribed += 1
        }
      }
    },
    invoke: vi.fn(),
    cancel: vi.fn()
  }
}))

const EXPOSURE: McpExposure = {
  slug: 'count_up',
  kind: 'action',
  description: null,
  unit: null,
  decimals: null,
  input_schema: { type: 'object', properties: {} }
}

const event = (state: JobState, progress: number | null): JobEvent => ({
  type: 'job',
  robot_id: '00000000-0000-4000-8000-000000000001',
  slug: 'count_up',
  job: {
    id: '00000000-0000-4000-8000-000000000002',
    robot_id: '00000000-0000-4000-8000-000000000001',
    slug: 'count_up',
    state,
    started_at: '2026-09-17T10:00:00.000Z',
    updated_at: '2026-09-17T10:00:01.000Z',
    seq: 1,
    result: state === 'succeeded' ? { count: 5 } : null,
    error: null
  },
  feedback: null,
  progress,
  timestamp_ms: 1_758_100_000_000
})

const sheetContext = (): RobotSheetContext => ({
  sheet: ref(null),
  reload: async () => {},
  onError: async () => null
})

describe('RobotCommandPanel', () => {
  it('follows the slug\'s job: a cancel while it runs, none once it has settled', async () => {
    const panel = await mountSuspended(CommandPanel, {
      props: { robotId: '00000000-0000-4000-8000-000000000001', exposure: EXPOSURE },
      global: { provide: { [RobotSheet as symbol]: sheetContext() } }
    })

    // Nothing has run on the slug yet, so there is nothing to stop.
    expect(panel.text()).not.toContain('Cancel')

    fake.handlers?.onJob(event('running', 0.4))
    await flushPromises()
    expect(panel.text()).toContain('running')
    expect(panel.text()).toContain('Cancel')

    // A settled job keeps its outcome on screen but loses the stop button.
    fake.handlers?.onJob(event('succeeded', 1))
    await flushPromises()
    expect(panel.text()).toContain('succeeded')
    expect(panel.text()).not.toContain('Cancel')

    const before = fake.unsubscribed
    panel.unmount()
    expect(fake.unsubscribed).toBe(before + 1)
  })
})

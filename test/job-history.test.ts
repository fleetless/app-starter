import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { JobRun } from '@fleetless/sdk'
import JobHistory from '~/components/robot/JobHistory.vue'
import { RobotSheet, type RobotSheetContext } from '~/composables/useDatasheet'

const ROBOT = '00000000-0000-4000-8000-000000000001'

const run: JobRun = {
  id: '00000000-0000-4000-8000-000000000002',
  robot_id: ROBOT,
  slug: 'count_up',
  kind: 'action',
  state: 'succeeded',
  started_at: '2026-09-17T10:00:00.000Z',
  ended_at: '2026-09-17T10:00:02.000Z',
  duration_ms: 2000,
  result: null,
  error: null,
  actor: { kind: 'app_user', id: '00000000-0000-4000-8000-000000000003', label: 'dev@example.com' },
  seq: 41,
  progress: null,
  feedback: null
}

// The first page is empty but carries a cursor — exactly what the cloud
// answers when the role's grants filter a page it had already read.
const history = vi.hoisted(() => vi.fn())
mockNuxtImport('useFleetless', () => () => ({ jobs: { history } }))

const sheetContext = (): RobotSheetContext => ({
  sheet: ref(null),
  reload: async () => {},
  onError: async () => null
})

describe('RobotJobHistory', () => {
  it('keeps paging after an empty page, and stops on a null cursor', async () => {
    history.mockResolvedValueOnce({ runs: [], next_cursor: 42 })
    history.mockResolvedValueOnce({ runs: [run], next_cursor: null })

    const page = await mountSuspended(JobHistory, {
      props: { robotId: ROBOT },
      global: { provide: { [RobotSheet as symbol]: sheetContext() } }
    })
    await flushPromises()

    // Empty, but not the end: the button is still there and nothing claims
    // that nothing has run.
    expect(history).toHaveBeenCalledWith(ROBOT, { limit: 50, beforeSeq: undefined })
    expect(page.text()).not.toContain('Nothing has run yet')
    expect(page.text()).toContain('Older')

    await page.find('button').trigger('click')
    await flushPromises()

    expect(history).toHaveBeenLastCalledWith(ROBOT, { limit: 50, beforeSeq: 42 })
    expect(page.text()).toContain('count_up')
    expect(page.text()).not.toContain('Older')
  })
})

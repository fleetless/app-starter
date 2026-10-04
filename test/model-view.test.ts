import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { FleetlessError, type DatapointEvent } from '@fleetless/sdk'
import { Object3D } from 'three'
import ModelView from '~/components/robot/ModelView.client.vue'
import { RobotSheet, type RobotSheetContext } from '~/composables/useDatasheet'

const fake = vi.hoisted(() => ({
  renderer: null as null | Record<string, ReturnType<typeof vi.fn>>,
  makeRobot: () => new Object3D(),
  setJoint: vi.fn()
}))

const client = vi.hoisted(() => ({
  assets: { prepareUrdfScene: vi.fn() },
  datapoints: { subscribe: vi.fn() }
}))

mockNuxtImport('useFleetless', () => () => client)

vi.mock('three', async importOriginal => ({
  ...(await importOriginal<typeof import('three')>()),
  WebGLRenderer: vi.fn(function () {
    fake.renderer = {
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      dispose: vi.fn(),
      forceContextLoss: vi.fn()
    }
    return fake.renderer
  })
}))

vi.mock('urdf-loader', () => ({
  default: vi.fn(function () {
    return { parse: () => fake.makeRobot() }
  })
}))

const { WebGLRenderer } = await import('three')

const sheetContext = (): RobotSheetContext => ({
  sheet: ref(null),
  reload: async () => {},
  onError: async () => 'The request did not go through.'
})

const ROBOT_ID = '00000000-0000-4000-8000-000000000001'

const resources = (overrides = {}) => ({
  urdfText: '<robot name="r"/>',
  missing: [],
  dispose: vi.fn(),
  ...overrides
})

const mountView = (jointStates: boolean) => mountSuspended(ModelView, {
  props: { robotId: ROBOT_ID, jointStates },
  global: { provide: { [RobotSheet as symbol]: sheetContext() } }
})

beforeEach(() => {
  vi.clearAllMocks()
  // The render loop is a plain requestAnimationFrame chain; tests do not need it running.
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  fake.makeRobot = () => {
    const robot = new Object3D()
    return Object.assign(robot, { joints: { j1: { setJointValue: fake.setJoint } } })
  }
  fake.setJoint.mockClear()
})

describe('RobotModelView', () => {
  it('shows the notice when no URDF is synced, and subscribes to nothing', async () => {
    client.assets.prepareUrdfScene.mockRejectedValue(new FleetlessError('no_urdf_synced', 'no urdf'))
    const view = await mountView(true)
    await flushPromises()

    expect(view.find('[data-testid="robot-3d-empty"]').text()).toContain('docs.fleetless.dev/concepts/exposure/#urdf-meshes')
    expect(view.find('[data-testid="robot-3d-error"]').exists()).toBe(false)
    expect(view.find('[data-testid="robot-3d-canvas"]').attributes('data-state')).toBe('empty')
    expect(client.datapoints.subscribe).not.toHaveBeenCalled()
  })

  it('shows an error for any other refusal, not the notice', async () => {
    client.assets.prepareUrdfScene.mockRejectedValue(new FleetlessError('forbidden', 'no'))
    const view = await mountView(false)
    await flushPromises()

    expect(view.find('[data-testid="robot-3d-error"]').exists()).toBe(true)
    expect(view.find('[data-testid="robot-3d-empty"]').exists()).toBe(false)
    expect(view.find('[data-testid="robot-3d-canvas"]').attributes('data-state')).toBe('error')
  })

  it('releases the assets and creates no WebGL object when it leaves before they arrive', async () => {
    let arrive!: (value: ReturnType<typeof resources>) => void
    client.assets.prepareUrdfScene.mockReturnValue(new Promise((resolve) => {
      arrive = resolve
    }))
    const view = await mountView(false)
    view.unmount()

    const prepared = resources()
    arrive(prepared)
    await flushPromises()

    expect(prepared.dispose).toHaveBeenCalledOnce()
    expect(WebGLRenderer).not.toHaveBeenCalled()
  })

  it('moves the joints from joint_states and stops the subscription on unmount', async () => {
    const prepared = resources()
    client.assets.prepareUrdfScene.mockResolvedValue(prepared)
    const unsubscribe = vi.fn()
    let onEvent!: (event: DatapointEvent) => void
    client.datapoints.subscribe.mockImplementation((_robot: string, slug: string, handlers: { onEvent: typeof onEvent }) => {
      expect(slug).toBe('joint_states')
      onEvent = handlers.onEvent
      return { unsubscribe }
    })

    const view = await mountView(true)
    await flushPromises()
    expect(view.find('[data-testid="robot-3d-canvas"]').attributes('data-state')).toBe('rendered')

    onEvent({ value: { name: ['j1'], position: [0.7] } } as unknown as DatapointEvent)
    await flushPromises()

    expect(fake.setJoint).toHaveBeenCalledWith(0.7)
    expect(view.find('[data-testid="robot-3d"]').attributes('data-joints')).toBe('{"j1":0.7}')

    view.unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(prepared.dispose).toHaveBeenCalledOnce()
    expect(fake.renderer?.dispose).toHaveBeenCalledOnce()
  })

  it('does not subscribe without the joint_states grant', async () => {
    client.assets.prepareUrdfScene.mockResolvedValue(resources())
    await mountView(false)
    await flushPromises()

    expect(client.datapoints.subscribe).not.toHaveBeenCalled()
  })
})

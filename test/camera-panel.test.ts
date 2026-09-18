import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { McpExposure } from '@fleetless/sdk'
import CameraPanel from '~/components/robot/CameraPanel.vue'
import { RobotSheet, type RobotSheetContext } from '~/composables/useDatasheet'

const ROBOT = '00000000-0000-4000-8000-000000000001'

// A LiveKit room that joins and then does whatever the test tells it to. The
// real one is a WebRTC stack; what this component owes it is the pairing of
// disconnect with release, which a fake can hold it to.
const live = vi.hoisted(() => ({
  handlers: new Map<string, (arg?: unknown) => void>(),
  disconnected: 0,
  released: 0,
  connect: null as null | (() => Promise<void>)
}))

vi.mock('livekit-client', () => {
  class FakeRoom {
    on(event: string, handler: (arg?: unknown) => void) {
      live.handlers.set(event, handler)
      return this
    }

    connect() {
      return live.connect ? live.connect() : Promise.resolve()
    }

    disconnect() {
      live.disconnected += 1
      return Promise.resolve()
    }
  }
  return {
    Room: FakeRoom,
    RoomEvent: { TrackSubscribed: 'trackSubscribed', TrackUnsubscribed: 'trackUnsubscribed', Disconnected: 'disconnected' },
    Track: { Kind: { Video: 'video' } }
  }
})

mockNuxtImport('useFleetless', () => () => ({
  cameras: {
    snapshot: () => Promise.resolve({ image: null, mime: null, width: null, height: null, timestamp_ms: null, age_ms: null }),
    live: () => Promise.resolve({
      session_id: 's',
      url: 'wss://livekit.example',
      room: 'r',
      token: 't',
      expires_at: '2026-09-17T11:00:00.000Z',
      release: () => {
        live.released += 1
        return Promise.resolve()
      }
    })
  }
}))

const EXPOSURE: McpExposure = {
  slug: 'front_camera',
  kind: 'camera',
  description: null,
  unit: null,
  decimals: null,
  input_schema: null
}

const sheetContext = (): RobotSheetContext => ({
  sheet: ref(null),
  reload: async () => {},
  onError: async () => null
})

const mount = () => mountSuspended(CameraPanel, {
  props: { robotId: ROBOT, exposure: EXPOSURE },
  global: { provide: { [RobotSheet as symbol]: sheetContext() } }
})

describe('RobotCameraPanel', () => {
  it('releases the hold when the room drops before any track arrived', async () => {
    live.handlers.clear()
    live.disconnected = 0
    live.released = 0
    live.connect = null

    const panel = await mount()
    await panel.find('button').trigger('click')
    await flushPromises()
    expect(panel.text()).toContain('Stop')

    // The robot never published, so nothing is ever unsubscribed: the drop
    // arrives as Disconnected alone.
    live.handlers.get('disconnected')?.()
    await flushPromises()

    expect(live.released).toBe(1)
    expect(panel.text()).toContain('Go live')
    expect(panel.text()).toContain('The stream ended.')

    // The hold is gone, so a second Go live starts from nothing rather than
    // overwriting a room that was never disconnected.
    await panel.find('button').trigger('click')
    await flushPromises()
    expect(live.released).toBe(1)
  })

  it('releases the hold when joining fails, and says why', async () => {
    live.handlers.clear()
    live.disconnected = 0
    live.released = 0
    live.connect = () => Promise.reject(new Error('no route to the SFU'))

    const panel = await mount()
    await panel.find('button').trigger('click')
    await flushPromises()

    expect(live.released).toBe(1)
    expect(live.disconnected).toBe(1)
    expect(panel.text()).toContain('Go live')
    // The join's own failure, not the Disconnected handler's sentence.
    expect(panel.text()).not.toContain('The stream ended.')
  })
})

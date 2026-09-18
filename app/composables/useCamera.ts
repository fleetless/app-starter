import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client'
import type { CameraLiveSession } from '@fleetless/sdk'
import { useIntervalFn } from '@vueuse/core'
import { sentenceFor } from '~/utils/errors'

/**
 * A camera: the snapshot, refreshed on an interval, and a live session that
 * costs a `release()` — held here so leaving the page releases it too.
 */
export function useCamera(robotId: string, slug: string, videoEl: Ref<HTMLVideoElement | null>) {
  const client = useFleetless()
  const snapshotUrl = ref<string | null>(null)
  const snapshotAgeMs = ref<number | null>(null)
  const snapshotProblem = ref<string | null>(null)
  const liveState = ref<'idle' | 'connecting' | 'live'>('idle')
  const liveProblem = ref<string | null>(null)
  // Optional on purpose, as in `useDatapoint`: under the robot page a
  // `forbidden` means the role changed and the page re-reads the sheet, which
  // withdraws this card; away from that page the sentence stands.
  const context = inject(RobotSheet, null)
  const refuse = (error: unknown) => context ? context.onError(error) : Promise.resolve(sentenceFor(error))

  // Not a ref: a livekit Room manages its own state, and Vue's proxy would
  // wrap objects the SDK does not expect wrapped.
  let room: Room | null = null
  let session: CameraLiveSession | null = null
  let stoppingDeliberately = false

  async function refreshSnapshot() {
    try {
      const snapshot = await client.cameras.snapshot(robotId, slug)
      snapshotAgeMs.value = snapshot.age_ms
      if (snapshot.image) {
        if (snapshotUrl.value) URL.revokeObjectURL(snapshotUrl.value)
        // The cast is TypeScript's, not the runtime's: `BlobPart` wants a view
        // on an ArrayBuffer, and a `Uint8Array` is typed over the shared one too.
        snapshotUrl.value = URL.createObjectURL(new Blob([snapshot.image as BlobPart], { type: snapshot.mime ?? 'image/jpeg' }))
      }
      snapshotProblem.value = null
    } catch (error) {
      snapshotProblem.value = await refuse(error)
    }
  }
  const { pause, resume } = useIntervalFn(refreshSnapshot, 5000, { immediate: false })

  async function startLive() {
    liveState.value = 'connecting'
    liveProblem.value = null
    try {
      session = await client.cameras.live(robotId, slug)
    } catch (error) {
      liveState.value = 'idle'
      liveProblem.value = await refuse(error)
      return
    }
    const next = new Room()
    next.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video && videoEl.value) track.attach(videoEl.value)
    })
    // The bridge stopping publishing ends the stream — unless this tab's own
    // disconnect() is what unsubscribed the track, which the flag tells apart.
    next.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video && !stoppingDeliberately) void stopLive('ended')
    })
    next.on(RoomEvent.Disconnected, () => {
      if (liveState.value === 'live') liveState.value = 'idle'
    })
    try {
      await next.connect(session.url, session.token)
      room = next
      liveState.value = 'live'
    } catch (error) {
      // The hold is real even though joining failed — release it. `release()`
      // is documented never to reject, so none of these awaits needs a catch.
      liveProblem.value = sentenceFor(error)
      await next.disconnect()
      await session.release()
      session = null
      liveState.value = 'idle'
    }
  }

  async function stopLive(reason: 'stopped' | 'ended' = 'stopped') {
    const closing = room
    const releasing = session
    room = null
    session = null
    liveState.value = 'idle'
    if (reason === 'ended') liveProblem.value = 'The stream ended.'
    stoppingDeliberately = true
    try {
      await closing?.disconnect()
    } finally {
      stoppingDeliberately = false
    }
    await releasing?.release()
  }

  onMounted(() => {
    void refreshSnapshot()
    resume()
  })
  onScopeDispose(() => {
    pause()
    if (snapshotUrl.value) URL.revokeObjectURL(snapshotUrl.value)
    if (room || session) void stopLive()
  })

  return { snapshotUrl, snapshotAgeMs, snapshotProblem, liveState, liveProblem, refreshSnapshot, startLive, stopLive }
}

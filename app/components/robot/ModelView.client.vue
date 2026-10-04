<script setup lang="ts">
// The robot's URDF, rendered in 3D from the assets the cloud synced for it.
// Follows docs `reference/sdk.md`, "Rendering a textured robot": the SDK
// installs one URL modifier on the LoadingManager, so every mesh, texture and
// `.dae`-embedded image is fetched with the bearer token first. That is why
// `createMeshLoader` must not be installed on the same manager.
// The `data-*` hooks on the wrapper and the canvas are a contract with
// fleetless/fleetless `infra/browser/app-starter-check.mjs` and
// `textured-render-check.mjs`: rename one and those checks fail.
import { AmbientLight, Box3, DirectionalLight, LoadingManager, Mesh, PerspectiveCamera, Scene, Texture, Vector3, WebGLRenderer, type Material } from 'three'
import URDFLoader from 'urdf-loader'
import { FleetlessError, type DatapointSubscription, type UrdfSceneResources } from '@fleetless/sdk'
import { applyJointState } from '~/utils/joint-states'
import { sentenceFor } from '~/utils/errors'

const props = defineProps<{ robotId: string, jointStates: boolean }>()
const client = useFleetless()
const { onError } = useRobotSheet()

const canvas = ref<HTMLCanvasElement>()
const state = ref<'loading' | 'empty' | 'rendered' | 'error'>('loading')
const problem = ref<string | null>(null)
const applied = ref<Record<string, number>>({})

const abort = new AbortController()
let unmounted = false
let resources: UrdfSceneResources | undefined
let renderer: WebGLRenderer | undefined
let scene: Scene | undefined
let rafId = 0
let resizer: ResizeObserver | undefined
let subscription: DatapointSubscription | undefined

async function fail(error: unknown) {
  if (unmounted) return
  if (error instanceof FleetlessError && error.code === 'no_urdf_synced') {
    state.value = 'empty'
    return
  }
  state.value = 'error'
  problem.value = (await onError(error)) ?? sentenceFor(error)
}

// Frame the robot so its bounding box fills the view from a three-quarter angle.
function frame(camera: PerspectiveCamera, object: Scene) {
  const box = new Box3().setFromObject(object)
  if (box.isEmpty()) return
  const center = box.getCenter(new Vector3())
  const distance = box.getSize(new Vector3()).length() * 0.6 || 1
  camera.position.copy(center).add(new Vector3(distance, distance * 0.6, distance))
  camera.lookAt(center)
}

function disposeScene(root: Scene) {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return
    node.geometry.dispose()
    const materials: Material[] = Array.isArray(node.material) ? node.material : [node.material]
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof Texture) value.dispose()
      }
      material.dispose()
    }
  })
}

onMounted(async () => {
  const manager = new LoadingManager()
  let prepared: UrdfSceneResources
  try {
    prepared = await client.assets.prepareUrdfScene(props.robotId, manager, { signal: abort.signal })
  } catch (error) {
    await fail(error)
    return
  }
  // The page may have left while the assets were fetched: release them and
  // create no WebGL object at all.
  if (unmounted) {
    prepared.dispose()
    return
  }
  resources = prepared

  try {
    const el = canvas.value
    if (!el) return
    renderer = new WebGLRenderer({ canvas: el, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    const camera = new PerspectiveCamera(45, 1, 0.01, 100)
    scene = new Scene()
    scene.add(new AmbientLight(0xffffff, 1.2))
    const sun = new DirectionalLight(0xffffff, 1.5)
    sun.position.set(2, 3, 4)
    scene.add(sun)

    // Loads start synchronously inside parse(); `started` tells us whether
    // anything is still loading once it returns.
    const started = { value: false }
    manager.onStart = () => {
      started.value = true
    }
    manager.onLoad = () => {
      if (unmounted || !renderer || !scene) return
      // Meshes arrive asynchronously, after parse(): the bounding box only has its size now.
      frame(camera, scene)
      renderer.render(scene, camera)
      state.value = 'rendered'
    }

    const robot = new URDFLoader(manager).parse(prepared.urdfText)
    // URDF is Z-up; three.js is Y-up.
    robot.rotation.x = -Math.PI / 2
    scene.add(robot)
    robot.updateMatrixWorld(true)
    frame(camera, scene)

    if (!started.value) {
      renderer.render(scene, camera)
      state.value = 'rendered'
    }

    const fit = () => {
      const width = el.clientWidth
      const height = el.clientHeight
      if (!width || !height || !renderer) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resizer = new ResizeObserver(fit)
    resizer.observe(el)
    fit()

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      if (renderer && scene) renderer.render(scene, camera)
    }
    tick()

    if (props.jointStates) {
      subscription = client.datapoints.subscribe(props.robotId, 'joint_states', {
        onEvent: (event) => {
          applied.value = { ...applied.value, ...applyJointState(robot.joints, event.value) }
        },
        onError: async (error) => {
          problem.value = (await onError(error)) ?? sentenceFor(error)
        }
      })
    }
  } catch (error) {
    await fail(error)
  }
})

onBeforeUnmount(() => {
  unmounted = true
  abort.abort()
  cancelAnimationFrame(rafId)
  resizer?.disconnect()
  subscription?.unsubscribe()
  resources?.dispose()
  if (scene) disposeScene(scene)
  renderer?.dispose()
  renderer?.forceContextLoss()
})
</script>

<template>
  <div data-testid="robot-3d" :data-joints="JSON.stringify(applied)" class="flex flex-col gap-3">
    <div class="relative h-[28rem] overflow-hidden rounded-md border border-default bg-elevated">
      <canvas
        v-show="state === 'loading' || state === 'rendered'"
        ref="canvas"
        data-testid="robot-3d-canvas"
        :data-state="state"
        class="size-full"
      />
      <p
        v-if="state === 'empty'"
        data-testid="robot-3d-empty"
        class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted"
      >
        This robot has no 3D model synced yet. How to sync one: docs.fleetless.dev/concepts/exposure/#urdf-meshes
      </p>
    </div>
    <UAlert
      v-if="problem"
      data-testid="robot-3d-error"
      color="error"
      variant="subtle"
      :title="problem"
    />
  </div>
</template>

<script setup lang="ts">
import type { Asset } from '@fleetless/sdk'

const props = defineProps<{ robotId: string }>()
const client = useFleetless()
const { onError } = useRobotSheet()
const assets = ref<Asset[]>([])
const problem = ref<string | null>(null)
const loaded = ref(false)

onMounted(async () => {
  try {
    assets.value = (await client.assets.list(props.robotId)).assets
  } catch (error) {
    problem.value = await onError(error)
  } finally {
    loaded.value = true
  }
})

// Through the SDK with the bearer attached: there is no signed URL to hand
// an <a href>, on purpose (the SDK reference says why).
async function download(asset: Asset) {
  try {
    const bytes = await client.assets.get(props.robotId, asset.id)
    // The cast is TypeScript's, not the runtime's: `BlobPart` wants a view on
    // an ArrayBuffer, and a `Uint8Array` is typed over the shared one too.
    const url = URL.createObjectURL(new Blob([bytes.body as BlobPart], { type: bytes.mime ?? 'application/octet-stream' }))
    const a = document.createElement('a')
    a.href = url
    a.download = asset.name
    // In the document and revoked on a timer: a click on a detached anchor is
    // ignored by some browsers, and a URL revoked in the same tick is gone
    // before the download has read it.
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    problem.value = await onError(error)
  }
}

const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="text-sm text-muted">
      The robot's URDF, its meshes and textures. Rendering them in 3D is the Live 3D recipe at docs.fleetless.dev/recipes/live-3d/.
    </p>
    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      :title="problem"
    />
    <p v-else-if="loaded && assets.length === 0" class="text-sm">
      No assets synced yet.
    </p>
    <UCard v-for="asset in assets" :key="asset.id">
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="font-mono text-sm truncate">
            {{ asset.name }}
          </p>
          <p class="text-xs text-muted">
            {{ asset.kind }} · {{ asset.media_type }} · {{ size(asset.size_bytes) }}
          </p>
        </div>
        <UButton
          label="Download"
          size="sm"
          variant="outline"
          icon="i-lucide-download"
          @click="download(asset)"
        />
      </div>
    </UCard>
  </div>
</template>

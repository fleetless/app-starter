<script setup lang="ts">
import type { McpExposure } from '@fleetless/sdk'
import { formatAge } from '~/utils/format'

const props = defineProps<{ robotId: string, exposure: McpExposure }>()
const videoEl = ref<HTMLVideoElement | null>(null)
const { snapshotUrl, snapshotAgeMs, snapshotProblem, liveState, liveProblem, startLive, stopLive } = useCamera(props.robotId, props.exposure.slug, videoEl)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <span class="font-mono text-sm">{{ exposure.slug }}</span>
        <UButton
          v-if="liveState === 'idle'"
          label="Go live"
          size="xs"
          icon="i-lucide-video"
          @click="startLive"
        />
        <UButton
          v-else
          label="Stop"
          size="xs"
          color="neutral"
          variant="outline"
          :loading="liveState === 'connecting'"
          @click="stopLive()"
        />
      </div>
      <p v-if="exposure.description" class="text-xs text-muted mt-1">
        {{ exposure.description }}
      </p>
    </template>

    <!-- v-show, not v-if: the element the track is attached to has to survive a re-render. -->
    <video
      v-show="liveState === 'live'"
      ref="videoEl"
      autoplay
      muted
      playsinline
      class="w-full rounded-md bg-black"
    />
    <template v-if="liveState !== 'live'">
      <img
        v-if="snapshotUrl"
        :src="snapshotUrl"
        :alt="exposure.slug"
        class="w-full rounded-md"
      >
      <p v-else class="text-sm text-muted">
        {{ snapshotProblem ?? 'No snapshot yet.' }}
      </p>
      <p v-if="snapshotAgeMs !== null" class="text-xs text-dimmed mt-1">
        snapshot {{ formatAge(snapshotAgeMs) }}
      </p>
    </template>
    <UAlert
      v-if="liveProblem"
      class="mt-3"
      color="error"
      variant="subtle"
      :title="liveProblem"
    />
  </UCard>
</template>
